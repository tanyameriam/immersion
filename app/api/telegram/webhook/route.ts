import { NextResponse } from "next/server";
import { processTelegramUpdate } from "@/lib/telegram/linking";

export const runtime = "nodejs";

/**
 * Telegram webhook (production). Register it once with:
 *   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 *     -d "url=https://app.layrrrd.com/api/telegram/webhook" \
 *     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
 * Telegram then echoes the secret on every delivery; we reject anything else.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();
    await processTelegramUpdate(update);
  } catch (err) {
    // Always 200 so Telegram doesn't retry a poison update forever.
    console.error("Telegram webhook processing failed", err);
  }
  return NextResponse.json({ ok: true });
}
