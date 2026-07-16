import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import { toResource } from "@/lib/map-item";
import { buildWebFeed } from "@/lib/recommendations/web-feed";
import type { TopicQuery } from "@/lib/recommendations/sources/types";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { StarterPick } from "@/lib/types/starter-list";
import type { Resource } from "@/lib/dashboard-data";
import { RECOMMENDATION_INTERESTS, slugify } from "@/lib/constants";

const MAX_RECS = 24;
const MAX_DISCOVER = 6;
/** How many of the user's strongest topics drive external source queries.
 * Topic results are cached daily and shared across users, so querying more
 * topics deepens the feed (infinite scroll) at negligible quota cost. */
const MAX_TOPIC_QUERIES = 6;
/** A starter pick is a weaker signal than actually saving something. */
const STARTER_PICK_WEIGHT = 0.5;

/**
 * Everyone's completed items - the community pool both recommendation buckets
 * draw from. User-agnostic, so one short-lived cache entry serves every
 * user's request; per-user exclusions and dismissals filter AFTER this, so
 * feedback stays instant. New saves take up to 5 minutes to reach OTHER
 * users' feeds, which is fine.
 */
const loadCommunityPool = unstable_cache(
  async (): Promise<KnowledgeItem[]> => {
    const snap = await adminDb()
      .collection("knowledgeItems")
      .where("status", "==", "completed")
      .get();
    return snap.docs.map((d) => toKnowledgeItem(d.id, d.data()));
  },
  ["community-pool"],
  { revalidate: 300 },
);

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
  /** Community items sharing topics the user already cares about. */
  matched: Resource[];
  /** A few popular items in topics the user hasn't picked yet — a gentle nudge. */
  discover: Resource[];
  /** Mixed-medium picks from external sources, matched to the user's taste. */
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

/** One recommendable link — the same URL saved by several people, grouped so
 * it surfaces once with a "saved by N" count. */
type Group = {
  item: KnowledgeItem;
  savers: Set<string>;
  topics: Set<string>; // display labels (original casing)
};

/**
 * Group items by URL. `topicsFor` decides whether an item belongs in the
 * bucket: return the topics to record for it, or null to skip it.
 */
function groupByUrl(
  items: KnowledgeItem[],
  topicsFor: (item: KnowledgeItem) => string[] | null,
): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const topics = topicsFor(item);
    if (!topics) continue;
    let g = groups.get(item.url);
    if (!g) {
      g = { item, savers: new Set(), topics: new Set() };
      groups.set(item.url, g);
    }
    g.savers.add(item.userId);
    for (const t of topics) g.topics.add(t);
  }
  return [...groups.values()];
}

function topRanked(
  groups: Group[],
  score: (g: Group) => number,
  limit: number,
): Group[] {
  return groups
    .map((g) => ({ g, score: score(g) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ g }) => g);
}

/** A group in the dashboard `Resource` shape, marked as a suggestion. */
function toSuggestion(g: Group, reason: string): Resource {
  return {
    ...toResource(g.item),
    savedDate: undefined, // it's a suggestion, not a bookmark
    reason,
    savers: g.savers.size,
  };
}

/**
 * Community recommendations: things saved by OTHER users. Two buckets:
 * - `matched`: shares topics the user already cares about (their own saves, or
 *   the interests they picked during onboarding if they haven't saved anything).
 * - `discover`: popular items whose topics are entirely outside what the user
 *   already knows — surfaced subtly to broaden their horizons.
 * Both group by URL so a link saved by several people surfaces once with a
 * "saved by N" count, and both exclude the user's own saves.
 */
export async function buildRecommendations(
  userId: string,
): Promise<Recommendations> {
  // The community pool is user-agnostic and the scan is the app's most
  // expensive Firestore call - start it immediately, in parallel with the
  // per-user taste profile.
  const poolPromise = loadCommunityPool();
  const profile = await loadTasteProfile(userId);
  const { excludedUrls, basis, knownTopics, basisLabels } = profile;
  if (basis.size === 0 && knownTopics.size === 0) {
    void poolPromise.catch(() => {}); // still warms the cache; never unhandled
    return { matched: [], discover: [], web: [], webHasMore: false }; // no basis yet
  }

  // External sources are network-bound — fetch them while we scan Firestore.
  const webPromise = buildWebFeed(profile);

  // Everyone else's completed items — one scan, reused for both buckets.
  const others = (await poolPromise).filter(
    (i) => i.userId !== userId && !excludedUrls.has(i.url),
  );

  // What each other user saves (normalized), so a discover item can explain
  // itself through savers who share the user's tastes.
  const saverTopics = new Map<string, Set<string>>();
  for (const i of others) {
    let set = saverTopics.get(i.userId);
    if (!set) {
      set = new Set();
      saverTopics.set(i.userId, set);
    }
    for (const t of i.ai?.topics ?? []) set.add(norm(t));
  }

  /** The user's interest most shared with this group's savers — the honest
   * "why" behind an otherwise out-of-taste discover item. Null when none of
   * the savers overlap with the user's basis at all. */
  function tasteBridge(g: Group): { label: string; savers: number } | null {
    const counts = new Map<string, number>();
    for (const saver of g.savers) {
      const theirs = saverTopics.get(saver);
      if (!theirs) continue;
      for (const t of basis)
        if (theirs.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    let best: { label: string; savers: number } | null = null;
    for (const [t, n] of counts) {
      if (!best || n > best.savers)
        best = { label: basisLabels.get(t) ?? t, savers: n };
    }
    return best;
  }

  // "For you": items sharing at least one basis topic, favoring broader
  // topic overlap first, then popularity.
  const matched = topRanked(
    groupByUrl(others, (it) => {
      const shared = (it.ai?.topics ?? []).filter((t) => basis.has(norm(t)));
      return shared.length > 0 ? shared : null;
    }),
    (g) => g.topics.size * 2 + g.savers.size,
    MAX_RECS,
  ).map((g) => {
    const topic = [...g.topics][0];
    const reason =
      g.savers.size > 1
        ? `Saved by ${g.savers.size} people interested in ${topic}`
        : `Because you're into ${topic}`;
    return {
      ...toSuggestion(g, reason),
      kind: "match" as const,
      reasonTopic: topic,
    };
  });

  // "Discover": popular items whose topics are ALL outside what the user
  // already knows. Ranked by popularity, with a boost for items saved by
  // people who share the user's tastes — those come with a real "why".
  const matchedUrls = new Set(matched.map((r) => r.url));
  const discover = topRanked(
    groupByUrl(others, (it) => {
      if (matchedUrls.has(it.url)) return null;
      const topics = it.ai?.topics ?? [];
      if (topics.length === 0) return null;
      if (topics.some((t) => knownTopics.has(norm(t)))) return null; // not new to them
      return topics;
    }),
    (g) => g.savers.size + (tasteBridge(g) ? 2 : 0),
    MAX_DISCOVER,
  ).map((g) => {
    const topic = [...g.topics][0];
    const bridge = tasteBridge(g);
    const reason = bridge
      ? bridge.savers > 1
        ? `New in ${topic}, saved by ${bridge.savers} people who are also into ${bridge.label}`
        : `New in ${topic}, saved by someone who's also into ${bridge.label}`
      : g.savers.size > 1
        ? `New in ${topic}, popular across the community (${g.savers.size} saves)`
        : `New in ${topic}, a fresh find from the community`;
    return {
      ...toSuggestion(g, reason),
      kind: "discover" as const,
      reasonTopic: topic,
      discoveryTopic: topic,
    };
  });

  const webPage = await webPromise;
  return { matched, discover, web: webPage.items, webHasMore: webPage.hasMore };
}
