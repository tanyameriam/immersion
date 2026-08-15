import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { degraded } from "@/lib/rudolf/trace";
import { buildRecommendations } from "@/lib/recommendations/generate";
import type { Resource } from "@/lib/dashboard-data";

/**
 * A compact per-user snapshot of the recommendation feed, cached in Firestore
 * so chat questions and nudges don't rebuild the full engine (Firestore scans
 * plus external fetches) on every message. Refreshed lazily on read.
 */

const COLLECTION = "feedCache";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 30;

export type FeedEntry = {
  title: string;
  url: string;
  source: string;
  contentType: string;
  readingTime: number;
  reason: string;
  kind: string;
  tldr: string;
};

function toEntry(r: Resource): FeedEntry {
  const tldr = r.description ?? "";
  return {
    title: r.title,
    url: r.url,
    source: r.source,
    contentType: r.contentType,
    readingTime: r.readingTime,
    reason: r.reason ?? "",
    kind: r.kind ?? "web",
    tldr: tldr.length > 200 ? `${tldr.slice(0, 200).trimEnd()}…` : tldr,
  };
}

/**
 * The user's current feed, from cache when fresh. On refresh failure returns
 * whatever stale entries exist (or []) — feed context is always optional.
 */
export async function getCachedFeed(
  userId: string,
  { maxAgeMs = MAX_AGE_MS }: { maxAgeMs?: number } = {},
): Promise<FeedEntry[]> {
  const ref = adminDb().collection(COLLECTION).doc(userId);
  let stale: FeedEntry[] = [];
  try {
    const snap = await ref.get();
    const data = snap.data();
    if (data?.entries) {
      const builtAt =
        data.builtAt instanceof Timestamp ? data.builtAt.toMillis() : 0;
      if (Date.now() - builtAt < maxAgeMs) return data.entries as FeedEntry[];
      stale = data.entries as FeedEntry[];
    }
  } catch (err) {
    console.error("feedCache read failed", userId, err);
    degraded("feed-cache-read", err);
  }

  try {
    const recs = await buildRecommendations(userId);
    const entries = [
      ...recs.matched.slice(0, 8),
      ...recs.discover.slice(0, 4),
      ...recs.web.slice(0, 18),
    ]
      .slice(0, MAX_ENTRIES)
      .map(toEntry);
    await ref.set({ builtAt: Timestamp.now(), entries });
    return entries;
  } catch (err) {
    // The answer still goes out, just without fresh picks — invisible to the
    // user and to the logs unless it is recorded on the receipt.
    console.error("feedCache refresh failed", userId, err);
    degraded("feed-refresh", err);
    return stale;
  }
}
