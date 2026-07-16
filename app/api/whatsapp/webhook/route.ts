import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, after } from "next/server";
import {
  processWhatsAppWebhook,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp/linking";

export const runtime = "nodejs";
// Chat replies and link ingestion can involve fetching pages + Claude calls.
export const maxDuration = 60;

/**
 * WhatsApp Cloud API webhook. Configure it once in the Meta app dashboard
 * (WhatsApp → Configuration): callback URL
 * https://app.layrrrd.com/api/whatsapp/webhook, verify token =
 * WHATSAPP_VERIFY_TOKEN, then subscribe to the "messages" field.
 */

/** Meta's one-time subscription handshake: echo the challenge back. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    params.get("hub.mode") === "subscribe" &&
    token &&
    params.get("hub.verify_token") === token
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/** Meta signs every delivery with HMAC-SHA256 of the raw body. */
function isValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!isValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    payload = null;
  }
  if (payload) {
    // Acknowledge immediately and do the work after the response — otherwise
    // Meta retries slow webhooks and the user gets duplicate replies.
    after(async () => {
      try {
        await processWhatsAppWebhook(payload);
      } catch (err) {
        console.error("WhatsApp webhook processing failed", err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
