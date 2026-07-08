import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const MAX_RECS = 24;
const MAX_DISCOVER = 6;

/** Topics come from different sources (AI analysis vs. onboarding checkboxes),
 * so compare them case-insensitively. */
const norm = (t: string) => t.toLowerCase().trim();

export type Recommendations = {
  /** Community items sharing topics the user already cares about. */
  matched: Resource[];
  /** A few popular items in topics the user hasn't picked yet — a gentle nudge. */
  discover: Resource[];
};

/** What the user already engages with — the basis for matching and exclusion. */
type TasteProfile = {
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
};

async function loadTasteProfile(userId: string): Promise<TasteProfile> {
  const mineSnap = await adminDb()
    .collection("knowledgeItems")
    .where("userId", "==", userId)
    .get();
  const mine = mineSnap.docs.map((d) => toKnowledgeItem(d.id, d.data()));
  const myUrls = new Set(mine.map((i) => i.url));
  const myTopics = new Set<string>();
  for (const i of mine) for (const t of i.ai?.topics ?? []) myTopics.add(norm(t));

  // Onboarding-selected interests seed recommendations for users who haven't
  // saved anything yet, so a brand-new account still has a basis to match on.
  const profileSnap = await adminDb().collection("users").doc(userId).get();
  const profile = profileSnap.data() ?? {};
  const preferredTopics: string[] = profile.preferredTopics ?? [];
  const preferredNorm = preferredTopics.map(norm);

  // Explicit "not for me" feedback from the Recommended tab.
  const dismissedUrls: string[] = profile.dismissedUrls ?? [];
  const mutedTopics: string[] = profile.mutedTopics ?? [];
  const mutedNorm = mutedTopics.map(norm);

  const basis = myTopics.size > 0 ? new Set(myTopics) : new Set(preferredNorm);
  for (const t of mutedNorm) basis.delete(t);

  return {
    excludedUrls: new Set([...myUrls, ...dismissedUrls]),
    basis,
    knownTopics: new Set([...myTopics, ...preferredNorm, ...mutedNorm]),
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
  const { excludedUrls, basis, knownTopics } = await loadTasteProfile(userId);
  if (basis.size === 0 && knownTopics.size === 0) {
    return { matched: [], discover: [] }; // no basis for recommendations yet
  }

  // Everyone else's completed items — one scan, reused for both buckets.
  const allSnap = await adminDb()
    .collection("knowledgeItems")
    .where("status", "==", "completed")
    .get();
  const others = allSnap.docs
    .map((d) => toKnowledgeItem(d.id, d.data()))
    .filter((i) => i.userId !== userId && !excludedUrls.has(i.url));

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
  // already knows. Ranked purely by popularity (how many people saved it).
  const matchedUrls = new Set(matched.map((r) => r.url));
  const discover = topRanked(
    groupByUrl(others, (it) => {
      if (matchedUrls.has(it.url)) return null;
      const topics = it.ai?.topics ?? [];
      if (topics.length === 0) return null;
      if (topics.some((t) => knownTopics.has(norm(t)))) return null; // not new to them
      return topics;
    }),
    (g) => g.savers.size,
    MAX_DISCOVER,
  ).map((g) => {
    const topic = [...g.topics][0];
    const reason =
      g.savers.size > 1
        ? `New in ${topic} — saved by ${g.savers.size} people`
        : `New in ${topic} — outside your usual`;
    return {
      ...toSuggestion(g, reason),
      kind: "discover" as const,
      reasonTopic: topic,
      discoveryTopic: topic,
    };
  });

  return { matched, discover };
}
