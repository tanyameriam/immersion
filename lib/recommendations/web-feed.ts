import { unstable_cache } from "next/cache";
import type { Resource } from "@/lib/dashboard-data";
import type { ItemMedium } from "@/lib/types/knowledge-item";
import type { TasteProfile } from "@/lib/recommendations/generate";
import { enabledSources } from "@/lib/recommendations/sources";
import type {
  Candidate,
  SourceFetcher,
  TopicQuery,
} from "@/lib/recommendations/sources/types";

/** Mixed-medium picks per page of the web feed. */
export const WEB_FEED_PAGE = 16;

/** Editorial refresh cadence. Medium's feeds churn fast (6h); API-metered
 * sources refresh daily, which also keeps quotas trivial. */
const REVALIDATE_SECONDS: Record<SourceFetcher["id"], number> = {
  medium: 6 * 60 * 60,
  youtube: 24 * 60 * 60,
  spotify: 24 * 60 * 60,
  google: 24 * 60 * 60,
};

/**
 * Topic-level cache: N users interested in "Product Design" share ONE upstream
 * call per source per revalidation window. Personalization (taste blending,
 * exclusions) happens per-request AFTER this cache, so cached data stays
 * user-agnostic and dismissals apply immediately.
 *
 * Fetchers throw on failure and the throw happens INSIDE the cached function,
 * so an upstream outage is never cached as an empty feed; the caller catches.
 */
const cachedFetchers = new Map<
  SourceFetcher["id"],
  (topic: TopicQuery) => Promise<Candidate[]>
>();

function cachedFetchTopic(source: SourceFetcher) {
  let fn = cachedFetchers.get(source.id);
  if (!fn) {
    fn = unstable_cache(
      (topic: TopicQuery) => source.fetchTopic(topic),
      // v2: bumped to invalidate candidates cached before Medium's feed
      // started extracting an image (see lib/recommendations/sources/
      // medium.ts) - same key forever would keep serving imageless entries
      // until the 6h window happened to lapse.
      ["recs-source-v2", source.id],
      { revalidate: REVALIDATE_SECONDS[source.id] },
    );
    cachedFetchers.set(source.id, fn);
  }
  return fn;
}

/** Same content behind trivially different URLs should dedupe: drop query
 * strings (except YouTube's video id) and trailing slashes. */
function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const v = u.searchParams.get("v");
    u.search = "";
    u.hash = "";
    if (v && u.hostname.includes("youtube.com")) u.search = `?v=${v}`;
    return `${u.origin}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return raw;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

type Scored = { candidate: Candidate; score: number };

/**
 * The mixed-medium "from around the web" feed: every enabled source × the
 * user's strongest topics, scored on a common 0-1 scale (within-batch
 * engagement percentile + taste-topic strength + freshness) and interleaved
 * across mediums so no platform dominates. Paged: `offset`/`limit` slice the
 * full ranked pool, and `hasMore` tells the client whether scrolling deeper
 * will yield anything.
 */
export async function buildWebFeed(
  profile: TasteProfile,
  { offset = 0, limit = WEB_FEED_PAGE }: { offset?: number; limit?: number } = {},
): Promise<{ items: Resource[]; hasMore: boolean }> {
  const topics = profile.topicQueries;
  const sources = enabledSources();
  if (!topics.length || !sources.length) return { items: [], hasMore: false };
  // No single source may fill more than ~60% of what's shown — balancing
  // only makes sense when there is more than one source to balance.
  const perSourceCap =
    sources.length > 1
      ? Math.max(6, Math.ceil((offset + limit) * 0.6))
      : Infinity;

  const batches = await Promise.all(
    sources.flatMap((source) =>
      topics.map(async (topic) => {
        try {
          return {
            sourceId: source.id,
            topic,
            candidates: await cachedFetchTopic(source)(topic),
          };
        } catch (err) {
          console.error(`web feed: ${source.id}/${topic.slug} failed`, err);
          return { sourceId: source.id, topic, candidates: [] as Candidate[] };
        }
      }),
    ),
  );

  const excluded = new Set([...profile.excludedUrls].map(canonicalUrl));
  const now = Date.now();

  // Score within each (source, topic) batch so raw engagement scales
  // (views vs rank position vs timestamps) never compete directly.
  const byUrl = new Map<string, Scored & { sourceId: string }>();
  for (const batch of batches) {
    const ranked = [...batch.candidates].sort(
      (a, b) => b.engagement - a.engagement,
    );
    ranked.forEach((candidate, i) => {
      const key = canonicalUrl(candidate.resource.url);
      if (excluded.has(key)) return;
      const engNorm = ranked.length > 1 ? 1 - i / (ranked.length - 1) : 1;
      const tasteWeight = 1 - batch.topic.rank / topics.length;
      const freshness = candidate.publishedAt
        ? Math.min(1, Math.max(0, 1 - (now - candidate.publishedAt) / (90 * DAY_MS)))
        : 0.5; // source didn't say — neutral
      const score = 0.5 * engNorm + 0.35 * tasteWeight + 0.15 * freshness;
      const existing = byUrl.get(key);
      if (!existing || score > existing.score) {
        byUrl.set(key, { candidate, score, sourceId: batch.sourceId });
      }
    });
  }

  // Interleave across mediums: repeatedly take the best remaining item from
  // the medium least represented so far, so the feed mixes rather than groups.
  const buckets = new Map<ItemMedium, (Scored & { sourceId: string })[]>();
  for (const entry of byUrl.values()) {
    const list = buckets.get(entry.candidate.medium) ?? [];
    list.push(entry);
    buckets.set(entry.candidate.medium, list);
  }
  for (const list of buckets.values()) list.sort((a, b) => b.score - a.score);

  const picks: Resource[] = [];
  const perSource = new Map<string, number>();
  const mediumCounts = new Map<ItemMedium, number>();
  // Build one item past the window so hasMore is exact.
  while (picks.length < offset + limit + 1 && buckets.size > 0) {
    // Least-represented medium first; break ties by its best remaining score.
    const medium = [...buckets.keys()].sort((a, b) => {
      const diff = (mediumCounts.get(a) ?? 0) - (mediumCounts.get(b) ?? 0);
      if (diff !== 0) return diff;
      return (buckets.get(b)![0]?.score ?? 0) - (buckets.get(a)![0]?.score ?? 0);
    })[0];
    const list = buckets.get(medium)!;
    const next = list.find(
      (e) => (perSource.get(e.sourceId) ?? 0) < perSourceCap,
    );
    if (!next) {
      buckets.delete(medium); // capped out or empty
      continue;
    }
    list.splice(list.indexOf(next), 1);
    if (!list.length) buckets.delete(medium);
    perSource.set(next.sourceId, (perSource.get(next.sourceId) ?? 0) + 1);
    mediumCounts.set(medium, (mediumCounts.get(medium) ?? 0) + 1);
    picks.push(next.candidate.resource);
  }
  return {
    items: picks.slice(offset, offset + limit),
    // More either interleaved past the window, or still in the pool (items a
    // capped-out source will surface once a deeper page raises its cap).
    hasMore: picks.length > offset + limit || byUrl.size > picks.length,
  };
}
