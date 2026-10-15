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
 * WhatsApp inbound via Twilio (the provider used when TWILIO_ACCOUNT_SID is
 * set - see lib/whatsapp/send.ts). In the Twilio console set "When a message
 * comes in" (Sandbox settings, or the sender's config) to
 * https://<host>/api/whatsapp/twilio, method POST.
 *
 * Twilio posts one form-encoded message per request. It's reshaped into the
 * Meta Cloud API payload so linking, chat and STOP handling stay shared with
 * the Meta webhook (app/api/whatsapp/webhook).
 */

/** Twilio signs base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
function isValidSignature(
  url: string,
  params: URLSearchParams,
  header: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !header) return false;
  const signed =
    url +
    [...params.keys()]
      .sort()
      .map((k) => k + params.get(k))
      .join("");
  const expected = createHmac("sha1", token).update(signed).digest("base64");
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Twilio's form fields for one inbound message → Meta's payload shape. */
function toMetaPayload(params: URLSearchParams): WhatsAppWebhookPayload | null {
  // WaId is the sender's bare wa_id; From is "whatsapp:+<wa_id>".
  const waId =
    params.get("WaId") || params.get("From")?.replace(/^whatsapp:\+?/, "");
  if (!waId) return null;
  const body = params.get("Body") ?? "";
  const buttonText = params.get("ButtonText");
  const message = buttonText
    ? { type: "button", button: { text: buttonText } }
    : body.trim()
      ? { type: "text", text: { body } }
      : // Media without a caption: a non-text type gets the "text only" reply.
        { type: params.get("MessageType") || "unsupported" };
  return {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [
                {
                  wa_id: waId,
                  profile: { name: params.get("ProfileName") ?? undefined },
                },
              ],
              // No id: read receipts/typing are Meta-only (markReadWithTyping).
              messages: [{ from: waId, ...message }],
            },
          },
        ],
      },
    ],
  };
}

/** Empty TwiML: acknowledge without Twilio sending a reply of its own. */
function ack() {
  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const params = new URLSearchParams(await req.text());
  if (
    !isValidSignature(req.url, params, req.headers.get("x-twilio-signature"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delivery receipts, if a status callback is ever configured: only
  // failures are worth logging, with Twilio's reason.
  const status = params.get("MessageStatus");
  if (status && !params.get("Body") && !params.get("ButtonText")) {
    if (status === "failed" || status === "undelivered") {
      console.error(
        "WhatsApp (Twilio) delivery failed",
        params.get("To"),
        params.get("ErrorCode"),
      );
    }
    return ack();
  }

  const payload = toMetaPayload(params);
  if (payload) {
    // Acknowledge immediately and do the work after the response - Twilio
    // times out slow webhooks (15s) and retries, which would double replies.
    after(async () => {
      try {
        await processWhatsAppWebhook(payload);
      } catch (err) {
        console.error("WhatsApp (Twilio) webhook processing failed", err);
      }
    });
  }
  return ack();
}
