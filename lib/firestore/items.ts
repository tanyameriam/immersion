import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { canonicalizeUrl } from "@/lib/items/canonical-url";
import type { KnowledgeItem, ProcessingStatus } from "@/lib/types/knowledge-item";

const COLLECTION = "knowledgeItems";

function hashId(userId: string, url: string): string {
  return createHash("sha256").update(`${userId}::${url}`).digest("hex").slice(0, 24);
}

/** Deterministic doc id so the same (user, url) dedupes to one document,
 * including share-link variants of the same page (see canonicalizeUrl). */
export function itemId(userId: string, url: string): string {
  return hashId(userId, canonicalizeUrl(url));
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
    note: data.note || undefined,
    blocked: data.blocked ? true : undefined,
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
  note?: string;
  /** Page content captured in the saver's browser (extension saves only). */
  clientContent?: {
    title?: string;
    text?: string;
    description?: string;
    image?: string;
  };
}): Promise<{ item: KnowledgeItem; created: boolean; reprocess: boolean }> {
  const canonicalUrl = canonicalizeUrl(input.url);
  const id = hashId(input.userId, canonicalUrl);
  const ref = adminDb().collection(COLLECTION).doc(id);
  let existing = await ref.get();
  // Items saved before URL canonicalization existed live under the raw-URL
  // hash; treat those as the same bookmark instead of creating a sibling.
  if (!existing.exists && canonicalUrl !== input.url) {
    const legacy = await adminDb()
      .collection(COLLECTION)
      .doc(hashId(input.userId, input.url))
      .get();
    if (legacy.exists) existing = legacy;
  }
  if (existing.exists) {
    const existingData = existing.data()!;
    const updates: Record<string, unknown> = {};
    // Re-saving with a comment still attaches it to the existing bookmark.
    if (input.note) updates.note = input.note;
    // Re-saving from the extension a page that previously couldn't be read
    // (bot challenge, paywall, failed fetch) now brings the content the
    // user's own browser sees: attach it and queue a reprocess.
    const unreadable =
      existingData.blocked ||
      existingData.status === "failed" ||
      existingData.ai?.degraded;
    const reprocess = Boolean(input.clientContent?.text && unreadable);
    if (reprocess) {
      updates.clientContent = input.clientContent;
      updates.status = "pending" satisfies ProcessingStatus;
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = FieldValue.serverTimestamp();
      await existing.ref.update(updates);
    }
    const data = { ...existingData, ...updates };
    return { item: toKnowledgeItem(existing.id, data), created: false, reprocess };
  }

  await ref.set({
    userId: input.userId,
    url: canonicalUrl,
    title: input.title ?? canonicalUrl,
    description: "",
    image: "",
    favicon: input.favicon ?? "",
    domain: domainOf(canonicalUrl),
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
    note: input.note ?? null,
    clientContent: input.clientContent ?? null,
  });

  const saved = await ref.get();
  return { item: toKnowledgeItem(id, saved.data()!), created: true, reprocess: false };
}

/**
 * List a user's items, newest first, via the (userId, createdAt DESC)
 * composite index - bounded and cursorable so a 10k-item library never gets
 * pulled whole. `cursor` is the createdAt ISO of the last item already seen.
 */
export async function listItems(
  userId: string,
  opts: { includeArchived?: boolean; limit?: number; cursor?: string } = {},
): Promise<KnowledgeItem[]> {
  let query = adminDb()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(opts.limit ?? 100);
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.startAfter(Timestamp.fromDate(cursorDate));
    }
  }
  const snap = await query.get();
  const items = snap.docs.map((d) => toKnowledgeItem(d.id, d.data()));
  return opts.includeArchived ? items : items.filter((i) => !i.isArchived);
}

/** Count a user's saved items (free-plan cap checks). Firestore aggregate -
 * no documents are read or billed beyond the single aggregation. */
export async function countItems(userId: string): Promise<number> {
  const snap = await adminDb()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Keyword/topic token search over the denormalized `keywords` / `topics`
 * arrays (lowercased at processing time). Firestore has no substring search;
 * this is exact-token matching via array-contains-any, which the declared
 * composite indexes cover. Items processed before the denormalization exist
 * only via recency until scripts/backfill-search-fields.mjs runs.
 */
export async function searchItems(
  userId: string,
  tokens: string[],
  opts: { limitPerField?: number } = {},
): Promise<KnowledgeItem[]> {
  const terms = [...new Set(tokens.map((t) => t.toLowerCase().trim()))]
    .filter(Boolean)
    .slice(0, 10); // array-contains-any cap
  if (terms.length === 0) return [];

  const base = adminDb().collection(COLLECTION).where("userId", "==", userId);
  const limitPerField = opts.limitPerField ?? 50;
  const [byKeyword, byTopic] = await Promise.all([
    base
      .where("keywords", "array-contains-any", terms)
      .orderBy("createdAt", "desc")
      .limit(limitPerField)
      .get(),
    base
      .where("topics", "array-contains-any", terms)
      .orderBy("createdAt", "desc")
      .limit(limitPerField)
      .get(),
  ]);

  const byId = new Map<string, KnowledgeItem>();
  for (const doc of [...byKeyword.docs, ...byTopic.docs]) {
    if (!byId.has(doc.id)) byId.set(doc.id, toKnowledgeItem(doc.id, doc.data()));
  }
  return [...byId.values()]
    .filter((i) => !i.isArchived)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
 * IDs of the current user's items that still need processing - used by the
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
