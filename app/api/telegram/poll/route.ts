import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { processTelegramUpdate } from "@/lib/telegram/linking";

export const runtime = "nodejs";

/**
 * Fetch pending Telegram updates via getUpdates and process them. This exists
 * for local development, where Telegram can't reach the webhook — the connect
 * UI calls it while waiting for the user to tap Start. In production (webhook
 * registered) getUpdates returns 409 and this becomes a harmless no-op.
 * Requires a signed-in user (or the CRON_SECRET, for ops/testing);
 * processing only ever redeems valid link codes.
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  if (!isCron) {
    try {
      await getAuthedUser(req);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw err;
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Telegram bot is not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?timeout=0`,
    );
    if (!res.ok) return NextResponse.json({ processed: 0, linked: 0 });
    const data = await res.json();
    const updates: { update_id: number }[] = data?.result ?? [];

    let linked = 0;
    let lastId = 0;
    for (const update of updates) {
      lastId = Math.max(lastId, update.update_id);
      if (await processTelegramUpdate(update)) linked++;
    }
    // Acknowledge processed updates so they aren't delivered again.
    if (updates.length > 0) {
      await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${lastId + 1}&timeout=0`,
      );
    }
    return NextResponse.json({ processed: updates.length, linked });
  } catch (err) {
    console.error("Telegram poll failed", err);
    return NextResponse.json({ processed: 0, linked: 0 });
  }
}
