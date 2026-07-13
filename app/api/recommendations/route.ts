import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import {
  buildRecommendations,
  loadTasteProfile,
} from "@/lib/recommendations/generate";
import { buildWebFeed } from "@/lib/recommendations/web-feed";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Recommendations for the current user. Without params: community matches,
 * discover nudges, and the first page of the web feed. With ?webOffset=N:
 * just the next page of the web feed (infinite scroll) — the community
 * buckets don't need recomputing to scroll deeper.
 */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);

    const webOffset = Number(
      new URL(req.url).searchParams.get("webOffset") ?? "",
    );
    if (Number.isFinite(webOffset) && webOffset > 0) {
      const profile = await loadTasteProfile(user.uid);
      const page = await buildWebFeed(profile, { offset: webOffset });
      return NextResponse.json({ web: page.items, webHasMore: page.hasMore });
    }

    const { matched, discover, web, webHasMore } = await buildRecommendations(
      user.uid,
    );
    // `recommendations` stays for backwards compatibility with existing clients.
    return NextResponse.json({
      recommendations: matched,
      discover,
      web,
      webHasMore,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/recommendations failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
