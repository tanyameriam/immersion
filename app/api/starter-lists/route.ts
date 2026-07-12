import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminDb } from "@/lib/firebase/admin";
import type { StarterItem } from "@/lib/types/starter-list";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_TOPICS = 31;
const MAX_ITEMS = 30;

export type StarterListResponseItem = StarterItem & {
  topicSlug: string;
  topic: string;
};

/**
 * Curated starter items for the given onboarding topics, e.g.
 * GET /api/starter-lists?topics=ux-design,ui-design
 *
 * Returns the union across topics, deduped by url and round-robin interleaved
 * so every selected topic is represented. Topics without a curated list are
 * skipped silently; an empty `items` array is a valid response, never an error.
 */
export async function GET(req: Request) {
  try {
    await getAuthedUser(req);

    const topicsParam = new URL(req.url).searchParams.get("topics") ?? "";
    const slugs = [
      ...new Set(
        topicsParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z0-9&-]+$/.test(s)),
      ),
    ].slice(0, MAX_TOPICS);

    if (!slugs.length) return NextResponse.json({ items: [] });

    const refs = slugs.map((slug) =>
      adminDb().collection("starterLists").doc(slug),
    );
    const docs = await adminDb().getAll(...refs);

    // One item queue per topic that actually has a curated list.
    const queues: { topicSlug: string; topic: string; items: StarterItem[] }[] =
      [];
    for (const doc of docs) {
      if (!doc.exists) continue;
      const data = doc.data()!;
      const items = Array.isArray(data.items) ? (data.items as StarterItem[]) : [];
      if (items.length) queues.push({ topicSlug: doc.id, topic: data.topic ?? doc.id, items });
    }

    // Round-robin across topics, deduping by url (first topic wins).
    const seen = new Set<string>();
    const result: StarterListResponseItem[] = [];
    for (let i = 0; result.length < MAX_ITEMS; i++) {
      let advanced = false;
      for (const q of queues) {
        if (result.length >= MAX_ITEMS) break;
        const item = q.items[i];
        if (!item) continue;
        advanced = true; // this queue still has items, keep cycling
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        result.push({ ...item, topicSlug: q.topicSlug, topic: q.topic });
      }
      if (!advanced) break;
    }

    return NextResponse.json({ items: result });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/starter-lists failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
