import { NextResponse, after } from "next/server";
import { processTelegramUpdate } from "@/lib/telegram/linking";

export const runtime = "nodejs";
// Chat replies and link ingestion can involve fetching pages + Claude calls.
export const maxDuration = 60;

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

  const update = await req.json().catch(() => null);
  if (update) {
    // Acknowledge immediately and do the work after the response — otherwise
    // Telegram retries slow webhooks and the user gets duplicate replies.
    after(async () => {
      try {
        await processTelegramUpdate(update);
      } catch (err) {
        console.error("Telegram webhook processing failed", err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
