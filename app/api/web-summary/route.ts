import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { getWebSummary } from "@/lib/recommendations/web-summary";

export const runtime = "nodejs";
export const maxDuration = 60; // extract + Claude can take a while cold

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * AI summary for a recommendation the user hasn't saved, e.g.
 * GET /api/web-summary?url=https://…
 * Cached by URL across users; a fresh URL costs one extract + Claude call.
 */
export async function GET(req: Request) {
  try {
    await getAuthedUser(req);
    const url = new URL(req.url).searchParams.get("url") ?? "";
    if (!isHttpUrl(url)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
    const summary = await getWebSummary(url);
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/web-summary failed", err);
    // The page may be paywalled or unreachable — the UI shows a friendly note.
    return NextResponse.json({ error: "Could not read this link" }, { status: 422 });
  }
}
