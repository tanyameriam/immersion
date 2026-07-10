import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { buildRecommendations } from "@/lib/recommendations/generate";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Community recommendations for the current user (topic overlap with others). */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const { matched, discover, web } = await buildRecommendations(user.uid);
    // `recommendations` stays for backwards compatibility with existing clients.
    return NextResponse.json({ recommendations: matched, discover, web });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/recommendations failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
