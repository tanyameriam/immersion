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

/** Total mixed-medium picks in the web feed. */
const WEB_FEED_SIZE = 16;
/** No single source may fill more than this many slots. */
const PER_SOURCE_CAP = 6;
/** How many of the user's strongest topics to query per source. */
const TOPICS_QUERIED = 3;

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
      ["recs-source-v1", source.id],
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
 * user's top topics, scored on a common 0-1 scale (within-batch engagement
 * percentile + taste-topic strength + freshness) and interleaved across
 * mediums so no platform dominates. Quality over volume: only the top
 * WEB_FEED_SIZE survive.
 */
export async function buildWebFeed(profile: TasteProfile): Promise<Resource[]> {
  const topics = profile.topicQueries.slice(0, TOPICS_QUERIED);
  const sources = enabledSources();
  if (!topics.length || !sources.length) return [];

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
      const tasteWeight = 1 - batch.topic.rank / TOPICS_QUERIED;
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
  while (picks.length < WEB_FEED_SIZE && buckets.size > 0) {
    // Least-represented medium first; break ties by its best remaining score.
    const medium = [...buckets.keys()].sort((a, b) => {
      const diff = (mediumCounts.get(a) ?? 0) - (mediumCounts.get(b) ?? 0);
      if (diff !== 0) return diff;
      return (buckets.get(b)![0]?.score ?? 0) - (buckets.get(a)![0]?.score ?? 0);
    })[0];
    const list = buckets.get(medium)!;
    const next = list.find(
      (e) => (perSource.get(e.sourceId) ?? 0) < PER_SOURCE_CAP,
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
  return picks;
}
