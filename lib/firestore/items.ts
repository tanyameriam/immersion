import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { KnowledgeItem, ProcessingStatus } from "@/lib/types/knowledge-item";

const COLLECTION = "knowledgeItems";

/** Deterministic doc id so the same (user, url) dedupes to one document. */
export function itemId(userId: string, url: string): string {
  return createHash("sha256").update(`${userId}::${url}`).digest("hex").slice(0, 24);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return "";
}

function toIsoOrNull(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/** Convert a Firestore document into the API-facing KnowledgeItem shape. */
export function toKnowledgeItem(
  id: string,
  data: FirebaseFirestore.DocumentData,
): KnowledgeItem {
  return {
    id,
    userId: data.userId,
    url: data.url,
    title: data.title ?? "",
    description: data.description ?? "",
    image: data.image ?? "",
    favicon: data.favicon ?? "",
    domain: data.domain ?? "",
    type: data.type ?? "article",
    status: (data.status ?? "pending") as ProcessingStatus,
    isFavorite: Boolean(data.isFavorite),
    isArchived: Boolean(data.isArchived),
    read: Boolean(data.read),
    readAt: toIsoOrNull(data.readAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    processingStartedAt: toIsoOrNull(data.processingStartedAt),
    retryCount: data.retryCount ?? 0,
    ai: data.ai ?? null,
    error: data.error ?? null,
  };
}

/**
 * Save a page as a pending knowledge item. Idempotent per (user, url): saving
 * the same URL twice returns the existing item instead of duplicating.
 */
export async function createPendingItem(input: {
  userId: string;
  url: string;
  title?: string;
  favicon?: string;
}): Promise<{ item: KnowledgeItem; created: boolean }> {
  const id = itemId(input.userId, input.url);
  const ref = adminDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return { item: toKnowledgeItem(id, existing.data()!), created: false };
  }

  await ref.set({
    userId: input.userId,
    url: input.url,
    title: input.title ?? input.url,
    description: "",
    image: "",
    favicon: input.favicon ?? "",
    domain: domainOf(input.url),
    type: "article",
    status: "pending",
    isFavorite: false,
    isArchived: false,
    read: false,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    processingStartedAt: null,
    retryCount: 0,
    ai: null,
    error: null,
  });

  const saved = await ref.get();
  return { item: toKnowledgeItem(id, saved.data()!), created: true };
}

/** List a user's items, newest first. */
export async function listItems(
  userId: string,
  opts: { includeArchived?: boolean; limit?: number } = {},
): Promise<KnowledgeItem[]> {
  // No orderBy in the query (avoids requiring a composite index for first-run
  // setup); sort newest-first in memory — fine at personal scale.
  const snap = await adminDb()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .limit(opts.limit ?? 500)
    .get();
  const items = snap.docs
    .map((d) => toKnowledgeItem(d.id, d.data()))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return opts.includeArchived ? items : items.filter((i) => !i.isArchived);
}

export async function getItem(
  userId: string,
  id: string,
): Promise<KnowledgeItem | null> {
  const doc = await adminDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  if (data.userId !== userId) return null;
  return toKnowledgeItem(doc.id, data);
}

export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()!.userId !== userId) return false;
  await ref.delete();
  return true;
}

/**
 * IDs of the current user's items that still need processing — used by the
 * "process-on-open" safety net. Includes items stuck in `processing` past the
 * staleness window (crash recovery).
 */
export async function findUnprocessedItemIds(
  userId: string,
  staleMs = 3 * 60 * 1000,
): Promise<string[]> {
  const snap = await adminDb()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .get();

  const now = Date.now();
  const ids: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const status = data.status as ProcessingStatus;
    if (status === "pending" || status === "failed") {
      ids.push(doc.id);
    } else if (status === "processing") {
      const startedAt =
        data.processingStartedAt instanceof Timestamp
          ? data.processingStartedAt.toMillis()
          : 0;
      if (now - startedAt > staleMs) ids.push(doc.id);
    }
  }
  return ids;
}
