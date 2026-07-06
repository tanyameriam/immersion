"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const POLL_MS = 3_000;
const MAX_POLLS = 20; // ~1 min ceiling

function hasWork(items: KnowledgeItem[]): boolean {
  return items.some(
    (i) =>
      i.status === "pending" || i.status === "processing" || i.status === "failed",
  );
}
function stillProcessing(items: KnowledgeItem[]): boolean {
  return items.some((i) => i.status === "pending" || i.status === "processing");
}

/**
 * Loads the current user's real saved items, drives the free "process-on-open"
 * AI sweep, and keeps polling until everything has finished processing — so
 * newly-saved links fill in with their AI summary live on the dashboard.
 */
export function useKnowledgeItems() {
  const { user, hydrated } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelled = useRef(false);

  const fetchItems = useCallback(async (): Promise<KnowledgeItem[]> => {
    const res = await apiFetch("/api/items");
    if (!res.ok) return [];
    const data = (await res.json()) as { items: KnowledgeItem[] };
    if (!cancelled.current) setItems(data.items ?? []);
    return data.items ?? [];
  }, []);

  /** Sweep + poll until nothing is pending/processing (or we hit the ceiling). */
  const syncUntilSettled = useCallback(
    async (seed: KnowledgeItem[]) => {
      let current = seed;
      let polls = 0;
      while (!cancelled.current && polls < MAX_POLLS && hasWork(current)) {
        try {
          await apiFetch("/api/items/process", { method: "POST" });
        } catch {
          // ignore; refetch anyway
        }
        if (cancelled.current) break;
        current = await fetchItems();
        if (!stillProcessing(current)) break;
        await new Promise((r) => setTimeout(r, POLL_MS));
        polls++;
      }
    },
    [fetchItems],
  );

  useEffect(() => {
    if (!hydrated || !user) return;
    cancelled.current = false;
    (async () => {
      setLoading(true);
      const current = await fetchItems();
      setLoading(false);
      await syncUntilSettled(current);
    })();
    return () => {
      cancelled.current = true;
    };
  }, [hydrated, user, fetchItems, syncUntilSettled]);

  /** Save a URL, then process it and refresh the list. */
  const save = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        return { ok: false, error: res.status === 400 ? "That doesn't look like a valid URL." : "Couldn't save the link." };
      }
      const current = await fetchItems();
      void syncUntilSettled(current);
      return { ok: true };
    },
    [fetchItems, syncUntilSettled],
  );

  /** Delete an item (persists to Firestore, then drops it locally). */
  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await apiFetch(`/api/items/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  }, []);

  // Memoized so consumers can safely useEffect on it without a render loop.
  const resources: Resource[] = useMemo(() => items.map(toResource), [items]);

  return { resources, loading, save, remove, refetch: fetchItems };
}
