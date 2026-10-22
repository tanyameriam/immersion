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

function twilioAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

/** Where Twilio reports a sent message's delivery (the inbound route logs
 * failures, the only place e.g. a closed 24h window shows up). Skipped
 * without a public app URL - Twilio can't reach localhost anyway. */
function twilioStatusCallback(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base || /localhost|127\.0\.0\.1/.test(base)) return null;
  return `${base.replace(/\/$/, "")}/api/whatsapp/twilio`;
}

/** Send through Twilio's Messages API. `to` is a bare wa_id (digits);
 * `content` is either a text Body or a template's ContentSid + variables. */
async function twilioSend(
  to: string,
  content: Record<string, string>,
): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  // e.g. "whatsapp:+14155238886" (the sandbox) or a registered sender.
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return false;
  const statusCallback = twilioStatusCallback();
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuth(sid, token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:+${to}`,
        ...content,
        ...(statusCallback ? { StatusCallback: statusCallback } : {}),
      }),
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
      if (usingTwilio()) return await twilioSend(to, { Body: text });
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
 * On Meta `name` is the template name; on Twilio it's the approved Content
 * template's ContentSid (HX…), whose language is fixed by the template.
 * No retry: a duplicate here is a second paid message.
 */
export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams: string[] = [],
): Promise<boolean> {
  if (!to || !name) return false;
  try {
    if (usingTwilio()) {
      return await twilioSend(to, {
        ContentSid: name,
        ContentVariables: JSON.stringify(
          Object.fromEntries(bodyParams.map((text, i) => [String(i + 1), text])),
        ),
      });
    }
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
  if (!messageId) return;
  try {
    if (usingTwilio()) {
      // Twilio's typing indicator (also marks the message read) takes the
      // inbound MessageSid.
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      if (!sid || !token) return;
      await fetch("https://messaging.twilio.com/v2/Indicators/Typing.json", {
        method: "POST",
        headers: {
          Authorization: twilioAuth(sid, token),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ messageId, channel: "whatsapp" }),
      });
      return;
    }
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
