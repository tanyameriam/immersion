import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import { buildWebFeed } from "@/lib/recommendations/web-feed";
import type { TopicQuery } from "@/lib/recommendations/sources/types";
import type { StarterPick } from "@/lib/types/starter-list";
import type { Resource } from "@/lib/dashboard-data";
import { RECOMMENDATION_INTERESTS, slugify } from "@/lib/constants";

/** How many of the user's strongest topics drive external source queries.
 * Topic results are cached daily and shared across users, so querying more
 * topics deepens the feed (infinite scroll) at negligible quota cost. */
const MAX_TOPIC_QUERIES = 6;
/** A starter pick is a weaker signal than actually saving something. */
const STARTER_PICK_WEIGHT = 0.5;

/** Topics come from different sources (AI analysis vs. onboarding checkboxes),
 * so compare them case-insensitively. */
const norm = (t: string) => t.toLowerCase().trim();

/** Starter picks store the topic slug; recover the display label from the
 * interest taxonomy (falls back to de-hyphenating unknown slugs). */
const SLUG_TO_LABEL = new Map(
  RECOMMENDATION_INTERESTS.map((label) => [slugify(label), label]),
);
const labelForSlug = (slug: string) =>
  SLUG_TO_LABEL.get(slug) ?? slug.replace(/-/g, " ");

export type Recommendations = {
  /** Always empty: recommending one user's saved item to another user who
   * shares a topic was removed - a save is personal, not a public signal for
   * matching strangers. Kept in the shape for API/client backwards
   * compatibility (see app/api/recommendations/route.ts). */
  matched: Resource[];
  /** Always empty, same reason as `matched`. */
  discover: Resource[];
  /** Mixed-medium picks from external sources, matched to the user's taste.
   * The only recommendation bucket left - nothing here depends on what
   * another user saved. */
  web: Resource[];
  /** Whether deeper pages of the web feed exist (infinite scroll). */
  webHasMore: boolean;
};

/** What the user already engages with — the basis for matching and exclusion. */
export type TasteProfile = {
  /** URLs never to recommend: the user's own saves plus links they marked
   * "Not interested". */
  excludedUrls: Set<string>;
  /** Topics "for you" matches are built from: own-save topics, or the
   * interests picked during onboarding if they haven't saved anything yet.
   * Muted topics are removed — hiding a topic stops it driving matches. */
  basis: Set<string>;
  /** Everything the user already knows (or explicitly hid) — excluded from
   * discovery. */
  knownTopics: Set<string>;
  /** Display labels for basis topics, keyed by normalized form — reasons cite
   * these instead of the lowercased matching keys. */
  basisLabels: Map<string, string>;
  /** Basis topics as display labels, strongest first (by how often the user
   * saves them; pure onboarding picks keep their picked order). */
  rankedBasis: string[];
  /** The strongest basis topics, ready for external source queries. */
  topicQueries: TopicQuery[];
};

export async function loadTasteProfile(userId: string): Promise<TasteProfile> {
  // Both reads are independent; run them together (each is a full network
  // round trip to Firestore, so sequencing them doubles the latency).
  const [mineSnap, profileSnap] = await Promise.all([
    adminDb().collection("knowledgeItems").where("userId", "==", userId).get(),
    adminDb().collection("users").doc(userId).get(),
  ]);
  const mine = mineSnap.docs.map((d) => toKnowledgeItem(d.id, d.data()));
  const myUrls = new Set(mine.map((i) => i.url));
  const myTopics = new Set<string>();
  const topicCounts = new Map<string, number>();
  const basisLabels = new Map<string, string>();
  for (const i of mine)
    for (const t of i.ai?.topics ?? []) {
      const n = norm(t);
      myTopics.add(n);
      topicCounts.set(n, (topicCounts.get(n) ?? 0) + 1);
      if (!basisLabels.has(n)) basisLabels.set(n, t.trim());
    }

  // Onboarding-selected interests seed recommendations for users who haven't
  // saved anything yet, so a brand-new account still has a basis to match on.
  const profile = profileSnap.data() ?? {};
  const preferredTopics: string[] = profile.preferredTopics ?? [];
  const preferredNorm = preferredTopics.map(norm);
  for (const t of preferredTopics) {
    const n = norm(t);
    if (!basisLabels.has(n)) basisLabels.set(n, t.trim());
  }

  // Starter picks from onboarding: a real taste signal for brand-new accounts.
  // Each pick counts toward its topic (weaker than a save), so a user who
  // picked mostly typography content ranks Typography above their other
  // interests before they've saved a single thing.
  const starterPicks: StarterPick[] = profile.starterPicks ?? [];
  const starterNorm = new Set<string>();
  for (const p of starterPicks) {
    const label = labelForSlug(p.topicSlug);
    const n = norm(label);
    starterNorm.add(n);
    topicCounts.set(n, (topicCounts.get(n) ?? 0) + STARTER_PICK_WEIGHT);
    if (!basisLabels.has(n)) basisLabels.set(n, label);
  }

  // Explicit "not for me" feedback from the Recommended tab.
  const dismissedUrls: string[] = profile.dismissedUrls ?? [];
  const mutedTopics: string[] = profile.mutedTopics ?? [];
  const mutedNorm = mutedTopics.map(norm);

  const basis =
    myTopics.size > 0
      ? new Set([...myTopics, ...starterNorm])
      : new Set([...starterNorm, ...preferredNorm]);
  for (const t of mutedNorm) basis.delete(t);

  // With no saves or picks, counts are all zero and the sort (stable) keeps
  // the order the user picked their interests in.
  const rankedBasis = [...basis]
    .sort((a, b) => (topicCounts.get(b) ?? 0) - (topicCounts.get(a) ?? 0))
    .map((n) => basisLabels.get(n) ?? n);

  return {
    excludedUrls: new Set([
      ...myUrls,
      ...dismissedUrls,
      ...starterPicks.map((p) => p.url), // they chose it already, don't re-suggest
    ]),
    basis,
    knownTopics: new Set([
      ...myTopics,
      ...preferredNorm,
      ...mutedNorm,
      ...starterNorm,
    ]),
    basisLabels,
    rankedBasis,
    topicQueries: rankedBasis
      .slice(0, MAX_TOPIC_QUERIES)
      .map((label, rank) => ({ label, slug: slugify(label), rank })),
  };
}

/**
 * Recommendations: external-source picks only (Medium, YouTube, Spotify,
 * Google search - see lib/recommendations/web-feed.ts), matched to the
 * user's taste profile. Recommending one user's saved item to another
 * because they share a topic was removed - a save is personal, not a
 * signal that should get pushed to other users, and it made bad or
 * unreadable saves (e.g. a bot-challenge page) show up as suggestions.
 * `matched`/`discover` stay in the return shape as empty arrays for
 * client compatibility (see app/api/recommendations/route.ts).
 */
export async function buildRecommendations(
  userId: string,
): Promise<Recommendations> {
  const profile = await loadTasteProfile(userId);
  if (profile.basis.size === 0 && profile.knownTopics.size === 0) {
    return { matched: [], discover: [], web: [], webHasMore: false }; // no basis yet
  }
  const webPage = await buildWebFeed(profile);
  return { matched: [], discover: [], web: webPage.items, webHasMore: webPage.hasMore };
}
