"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem, ProcessingStatus } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const SWEEP_MS = 6_000;
/** Newest saves stay live via onSnapshot; older pages load on demand. Keeps a
 * dashboard open at ~200 doc reads instead of the whole library. */
const LIVE_WINDOW = 200;
const PAGE_SIZE = 100;

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
 * Live-loads the newest window of the current user's saved items via Firestore
 * onSnapshot (so saves from the web app OR the extension appear instantly, no
 * manual refresh), pages older items in on demand, and drives the free
 * AI-processing sweep until everything is done.
 */
export function useKnowledgeItems() {
  const { user, hydrated } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [older, setOlder] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // True while the live window is full - there may be older items beyond it.
  const [windowFull, setWindowFull] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const sweeping = useRef(false);
  // Pagination cursors: the live window's last doc (first page) and the last
  // doc of the most recent older page (subsequent pages).
  const liveLastDoc = useRef<QueryDocumentSnapshot | null>(null);
  const olderLastDoc = useRef<QueryDocumentSnapshot | null>(null);

  // Live subscription over the newest window.
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    setOlder([]);
    setExhausted(false);
    olderLastDoc.current = null;
    const q = query(
      collection(db, "knowledgeItems"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(LIVE_WINDOW),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => toItem(d.id, d.data() as Record<string, unknown>))
          .filter((i) => !i.isArchived);
        liveLastDoc.current = snap.docs[snap.docs.length - 1] ?? null;
        setWindowFull(snap.docs.length === LIVE_WINDOW);
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

  /** Fetch the next page of older items (one-shot reads, not live). */
  const loadMore = useCallback(async () => {
    if (!user || loadingMore || exhausted) return;
    const cursor = olderLastDoc.current ?? liveLastDoc.current;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "knowledgeItems"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(PAGE_SIZE),
        ),
      );
      olderLastDoc.current = snap.docs[snap.docs.length - 1] ?? olderLastDoc.current;
      if (snap.docs.length < PAGE_SIZE) setExhausted(true);
      const page = snap.docs
        .map((d) => toItem(d.id, d.data() as Record<string, unknown>))
        .filter((i) => !i.isArchived);
      setOlder((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.filter((i) => !seen.has(i.id))];
      });
    } catch (err) {
      console.error("Failed to load older bookmarks", err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore, exhausted]);

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
    async (
      url: string,
    ): Promise<{ ok: boolean; created?: boolean; error?: string }> => {
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
      // 201 = fresh save, 200 = the bookmark already existed.
      const data = (await res.json().catch(() => null)) as
        | { created?: boolean }
        | null;
      const created = data?.created !== false;
      try {
        track("link_saved", { domain: new URL(url).hostname.replace(/^www\./, "") });
      } catch {
        // invalid URL already rejected above; never let analytics break a save
      }
      return { ok: true, created };
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    // onSnapshot drops live items; older pages have no snapshot, so update
    // that state directly. Also delete on the server.
    setOlder((prev) => prev.filter((i) => i.id !== id));
    try {
      await apiFetch(`/api/items/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  }, []);

  /** Persist read/unread (client write; rules allow the `read` field). */
  const markRead = useCallback(async (id: string, read = true) => {
    setOlder((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, read, readAt: read ? new Date().toISOString() : null }
          : i,
      ),
    );
    try {
      await updateDoc(doc(db, "knowledgeItems", id), {
        read,
        readAt: read ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  }, []);

  // Live window first, then loaded older pages (deduped: an item can drift
  // from an older page into the live window when things are deleted).
  const resources: Resource[] = useMemo(() => {
    const liveIds = new Set(items.map((i) => i.id));
    return [...items, ...older.filter((i) => !liveIds.has(i.id))].map(toResource);
  }, [items, older]);

  const hasMore = windowFull && !exhausted;

  return {
    resources,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    save,
    remove,
    markRead,
  };
}
