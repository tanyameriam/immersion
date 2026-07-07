import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const MAX_RECS = 24;

/**
 * Community recommendations: things saved by OTHER users that share topics with
 * what the current user saves. Grouped by URL, so a link saved by several
 * people surfaces once with a "saved by N" count for social proof. Excludes the
 * user's own saves and anything they already have.
 */
export async function buildRecommendations(userId: string): Promise<Resource[]> {
  // 1. What does this user save? (their topics + already-saved URLs)
  const mineSnap = await adminDb()
    .collection("knowledgeItems")
    .where("userId", "==", userId)
    .get();
  const mine = mineSnap.docs.map((d) => toKnowledgeItem(d.id, d.data()));
  const myUrls = new Set(mine.map((i) => i.url));
  const myTopics = new Set<string>();
  for (const i of mine) for (const t of i.ai?.topics ?? []) myTopics.add(t);
  if (myTopics.size === 0) return []; // no basis for recommendations yet

  // 2. Everyone else's completed items.
  const allSnap = await adminDb()
    .collection("knowledgeItems")
    .where("status", "==", "completed")
    .get();
  const others = allSnap.docs
    .map((d) => toKnowledgeItem(d.id, d.data()))
    .filter((i) => i.userId !== userId && !myUrls.has(i.url));

  // 3. Group by URL; track distinct savers + which of MY topics overlap.
  type Group = {
    item: KnowledgeItem;
    savers: Set<string>;
    sharedTopics: Set<string>;
  };
  const groups = new Map<string, Group>();
  for (const it of others) {
    const shared = (it.ai?.topics ?? []).filter((t) => myTopics.has(t));
    if (shared.length === 0) continue;
    let g = groups.get(it.url);
    if (!g) {
      g = { item: it, savers: new Set(), sharedTopics: new Set() };
      groups.set(it.url, g);
    }
    g.savers.add(it.userId);
    shared.forEach((t) => g.sharedTopics.add(t));
  }

  // 4. Rank by topic overlap (weighted) + how many people saved it.
  const ranked = [...groups.values()]
    .map((g) => ({ g, score: g.sharedTopics.size * 2 + g.savers.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECS);

  return ranked.map(({ g }) => {
    const savers = g.savers.size;
    const topic = [...g.sharedTopics][0];
    const reason =
      savers > 1
        ? `Saved by ${savers} people interested in ${topic}`
        : `Because you save about ${topic}`;
    return {
      ...toResource(g.item),
      savedDate: undefined, // it's a suggestion, not a bookmark
      reason,
      savers,
    };
  });
}
