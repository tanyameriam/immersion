/**
 * WhatsApp senders. Replies to a user-initiated conversation are free (on
 * Meta's side) inside the 24-hour customer-service window, which covers
 * chat. Outside that window only pre-approved templates can be sent, and
 * Meta charges per delivered template (see sendWhatsAppTemplate).
 *
 * Two providers, picked by env: Twilio when TWILIO_ACCOUNT_SID is set (its
 * free sandbox needs no Meta business, which makes it the easy way to test),
 * otherwise Meta's Cloud API directly. Everything above this file - linking,
 * chat, digests - is provider-agnostic.
 * No-ops gracefully if config is missing so nothing hard-fails on env.
 */

const GRAPH_VERSION = "v23.0";

/** True when WhatsApp goes through Twilio rather than Meta directly. */
export function usingTwilio(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID);
}

/** Longest text body one message can carry: Twilio caps WhatsApp bodies at
 * 1600 characters, Meta at 4096 (both kept a little under). */
export function maxTextLength(): number {
  return usingTwilio() ? 1500 : 4000;
}

/** Send through Twilio's Messages API. `to` is a bare wa_id (digits). */
async function twilioSend(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  // e.g. "whatsapp:+14155238886" (the sandbox) or a registered sender.
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return false;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:+${to}`, Body: body }),
    },
  );
  if (!res.ok) {
    // Twilio puts the reason (unjoined sandbox number, closed window, …) in
    // the body.
    console.error("WhatsApp (Twilio) send failed", res.status, await res.text());
  }
  return res.ok;
}

function messagesUrl(): string | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId || !process.env.WHATSAPP_ACCESS_TOKEN) return null;
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

async function graphPost(body: Record<string, unknown>): Promise<boolean> {
  const url = messagesUrl();
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Meta packs the reason (bad token, closed window, …) into the body.
    console.error("WhatsApp send failed", res.status, await res.text());
  }
  return res.ok;
}

/**
 * Send a plain-text message. Retries once on transient network errors, like
 * the Telegram sender. WhatsApp has no HTML mode — text goes out verbatim.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<boolean> {
  if (!to) return false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (usingTwilio()) return await twilioSend(to, text);
      return await graphPost({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      });
    } catch (err) {
      console.error(`WhatsApp send failed (attempt ${attempt})`, err);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}

/**
 * Send a pre-approved message template - the only thing WhatsApp allows
 * outside the 24-hour window, and billed per delivery. `bodyParams` fill
 * the template body's {{1}}, {{2}}, … in order; Meta rejects empty ones.
 * No retry: a duplicate here is a second paid message. Meta only: on Twilio
 * templates are separate "Content" resources this doesn't use, so it returns
 * false and the digest cron falls back to email.
 */
export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams: string[] = [],
): Promise<boolean> {
  if (!to || !name || usingTwilio()) return false;
  try {
    return await graphPost({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(bodyParams.length
          ? {
              components: [
                {
                  type: "body",
                  parameters: bodyParams.map((text) => ({ type: "text", text })),
                },
              ],
            }
          : {}),
      },
    });
  } catch (err) {
    console.error("WhatsApp template send failed", err);
    return false;
  }
}

/**
 * Mark an inbound message read and show a typing indicator while Rudolf
 * works on the reply. Unlike Telegram, WhatsApp only offers typing as a
 * reaction to a specific received message. Cosmetic only — never throws.
 */
export async function markReadWithTyping(messageId: string): Promise<void> {
  // Meta only - Twilio message ids mean nothing to the Graph API.
  if (!messageId || usingTwilio()) return;
  try {
    await graphPost({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  } catch {
    // cosmetic only — never fail the reply over it
  }
}
