import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { findUnprocessedItemIds } from "@/lib/firestore/items";
import { processItems } from "@/lib/items/process-item";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Process-on-open safety net: finishes any of the current user's items that are
 * still pending/failed/stale. Called by the dashboard on load (and while items
 * show as processing). Free — no cron required. Bounds work per request so a
 * large backlog can't blow the serverless time limit; the client polls again.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const ids = (await findUnprocessedItemIds(user.uid)).slice(0, 5);
    await processItems(ids);
    return NextResponse.json({ processed: ids.length });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/items/process failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
