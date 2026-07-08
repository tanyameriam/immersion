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
  // 1. What the user already engages with: their saved topics + saved URLs.
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
  const preferredTopics: string[] = profileSnap.data()?.preferredTopics ?? [];
  const preferredNorm = preferredTopics.map(norm);

  // Basis for "for you" matches: own-save topics, else stated interests.
  const basis = myTopics.size > 0 ? myTopics : new Set(preferredNorm);
  // Everything the user already "knows" — used to exclude from discovery.
  const knownTopics = new Set<string>([...myTopics, ...preferredNorm]);

  if (basis.size === 0 && knownTopics.size === 0) {
    return { matched: [], discover: [] }; // no basis for recommendations yet
  }

  // 2. Everyone else's completed items — one scan, reused for both buckets.
  const allSnap = await adminDb()
    .collection("knowledgeItems")
    .where("status", "==", "completed")
    .get();
  const others = allSnap.docs
    .map((d) => toKnowledgeItem(d.id, d.data()))
    .filter((i) => i.userId !== userId && !myUrls.has(i.url));

  type Group = {
    item: KnowledgeItem;
    savers: Set<string>;
    topics: Set<string>; // display labels (original casing)
  };

  // 3a. "For you": items sharing at least one basis topic.
  const matchGroups = new Map<string, Group>();
  for (const it of others) {
    const shared = (it.ai?.topics ?? []).filter((t) => basis.has(norm(t)));
    if (shared.length === 0) continue;
    let g = matchGroups.get(it.url);
    if (!g) {
      g = { item: it, savers: new Set(), topics: new Set() };
      matchGroups.set(it.url, g);
    }
    g.savers.add(it.userId);
    shared.forEach((t) => g.topics.add(t));
  }

  const matched = [...matchGroups.values()]
    .map((g) => ({ g, score: g.topics.size * 2 + g.savers.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECS)
    .map(({ g }) => {
      const savers = g.savers.size;
      const topic = [...g.topics][0];
      const reason =
        savers > 1
          ? `Saved by ${savers} people interested in ${topic}`
          : `Because you're into ${topic}`;
      return {
        ...toResource(g.item),
        savedDate: undefined, // it's a suggestion, not a bookmark
        reason,
        savers,
        kind: "match" as const,
      };
    });

  // 3b. "Discover": popular items whose topics are ALL outside what the user
  // already knows. Ranked purely by popularity (how many people saved it).
  const matchedUrls = new Set(matched.map((r) => r.url));
  const discoverGroups = new Map<string, Group>();
  for (const it of others) {
    if (matchedUrls.has(it.url)) continue;
    const topics = it.ai?.topics ?? [];
    if (topics.length === 0) continue;
    if (topics.some((t) => knownTopics.has(norm(t)))) continue; // not new to them
    let g = discoverGroups.get(it.url);
    if (!g) {
      g = { item: it, savers: new Set(), topics: new Set() };
      discoverGroups.set(it.url, g);
    }
    g.savers.add(it.userId);
    topics.forEach((t) => g.topics.add(t));
  }

  const discover = [...discoverGroups.values()]
    .map((g) => ({ g, score: g.savers.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DISCOVER)
    .map(({ g }) => {
      const savers = g.savers.size;
      const topic = [...g.topics][0];
      const reason =
        savers > 1
          ? `New in ${topic} — saved by ${savers} people`
          : `New in ${topic} — outside your usual`;
      return {
        ...toResource(g.item),
        savedDate: undefined,
        reason,
        savers,
        kind: "discover" as const,
        discoveryTopic: topic,
      };
    });

  return { matched, discover };
}
