"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem, ProcessingStatus } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const SWEEP_MS = 6_000;

function iso(v: unknown): string {
  const t = v as Timestamp | undefined;
  return t?.toDate ? t.toDate().toISOString() : "";
}

/** Map a client Firestore doc into the shared KnowledgeItem shape. */
function toItem(id: string, d: Record<string, unknown>): KnowledgeItem {
  return {
    id,
    userId: d.userId as string,
    url: (d.url as string) ?? "",
    title: (d.title as string) ?? "",
    description: (d.description as string) ?? "",
    image: (d.image as string) ?? "",
    favicon: (d.favicon as string) ?? "",
    domain: (d.domain as string) ?? "",
    type: (d.type as string) ?? "article",
    status: ((d.status as ProcessingStatus) ?? "pending"),
    isFavorite: Boolean(d.isFavorite),
    isArchived: Boolean(d.isArchived),
    read: Boolean(d.read),
    readAt: iso(d.readAt) || null,
    createdAt: iso(d.createdAt) || new Date().toISOString(),
    updatedAt: iso(d.updatedAt),
    processingStartedAt: iso(d.processingStartedAt) || null,
    retryCount: (d.retryCount as number) ?? 0,
    ai: (d.ai as KnowledgeItem["ai"]) ?? null,
    error: (d.error as string) ?? null,
  };
}

/**
 * Live-loads the current user's saved items via Firestore onSnapshot (so saves
 * from the web app OR the extension appear instantly, no manual refresh), and
 * drives the free AI-processing sweep until everything is done.
 */
export function useKnowledgeItems() {
  const { user, hydrated } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const sweeping = useRef(false);

  // Live subscription.
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    const q = query(
      collection(db, "knowledgeItems"),
      where("userId", "==", user.uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => toItem(d.id, d.data() as Record<string, unknown>))
          .filter((i) => !i.isArchived)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setItems(next);
        setLoading(false);
      },
      (err) => {
        console.error("knowledgeItems snapshot error", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [hydrated, user]);

  // Kick the server-side AI sweep whenever something still needs processing.
  const hasWork = items.some(
    (i) => i.status === "pending" || i.status === "processing" || i.status === "failed",
  );
  useEffect(() => {
    if (!hasWork) return;
    let cancelled = false;
    const sweep = async () => {
      if (sweeping.current || cancelled) return;
      sweeping.current = true;
      try {
        await apiFetch("/api/items/process", { method: "POST" });
      } catch {
        // ignore; onSnapshot reflects results
      } finally {
        sweeping.current = false;
      }
    };
    sweep();
    const interval = setInterval(sweep, SWEEP_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasWork]);

  const save = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error:
            res.status === 400
              ? "That doesn't look like a valid URL."
              : "Couldn't save the link.",
        };
      }
      try {
        track("link_saved", { domain: new URL(url).hostname.replace(/^www\./, "") });
      } catch {
        // invalid URL already rejected above; never let analytics break a save
      }
      return { ok: true };
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    // onSnapshot will drop it; also delete on the server.
    try {
      await apiFetch(`/api/items/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  }, []);

  /** Persist read/unread (client write; rules allow the `read` field). */
  const markRead = useCallback(async (id: string, read = true) => {
    try {
      await updateDoc(doc(db, "knowledgeItems", id), {
        read,
        readAt: read ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  }, []);

  const resources: Resource[] = useMemo(() => items.map(toResource), [items]);

  return { resources, loading, save, remove, markRead };
}
