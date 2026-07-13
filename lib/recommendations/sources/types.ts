import type { ItemMedium } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

/** One taste-profile topic to query sources with. */
export type TopicQuery = {
  /** Display label, e.g. "UX Design" — used in queries and reasons. */
  label: string;
  /** slugify(label) — Medium tags and cache keys. */
  slug: string;
  /** Position in the user's ranked basis (0 = strongest interest). */
  rank: number;
};

/** A normalized item from one source, before cross-source ranking. */
export type Candidate = {
  resource: Resource;
  medium: ItemMedium;
  /** The topic this candidate was fetched for (cited in the reason). */
  topic: string;
  /**
   * Source-native engagement score (views, popularity, rank position, or
   * recency where the source exposes nothing better). Only compared WITHIN
   * one (source, topic) batch — the feed builder converts it to a percentile,
   * so scales never need to agree across sources.
   */
  engagement: number;
  /** Publication time (ms epoch), 0 when the source doesn't say. */
  publishedAt: number;
};

/**
 * One content source. `fetchTopic` returns top candidates for a topic and
 * THROWS on upstream failure — the feed builder catches outside the cache
 * layer so an outage is never cached as an empty result.
 */
export type SourceFetcher = {
  id: "medium" | "youtube" | "spotify" | "google";
  medium: ItemMedium;
  /** False when required API keys are missing — the source is skipped. */
  enabled: () => boolean;
  fetchTopic: (topic: TopicQuery) => Promise<Candidate[]>;
};

export const FETCH_TIMEOUT_MS = 6000;

/** Average reading speed, for estimating minutes from text lengths. */
export const WORDS_PER_MINUTE = 225;
