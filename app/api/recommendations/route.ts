import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { buildRecommendations } from "@/lib/recommendations/generate";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Community recommendations for the current user (topic overlap with others). */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const recommendations = await buildRecommendations(user.uid);
    return NextResponse.json({ recommendations });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/recommendations failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
