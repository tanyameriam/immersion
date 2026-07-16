/**
 * WhatsApp Cloud API senders. Replies to a user-initiated conversation are
 * free inside Meta's 24-hour customer-service window, which covers all of
 * Rudolf's Phase 1 behavior (the bot only ever answers inbound messages).
 * No-ops gracefully if config is missing so nothing hard-fails on env.
 */

const GRAPH_VERSION = "v23.0";

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
 * Mark an inbound message read and show a typing indicator while Rudolf
 * works on the reply. Unlike Telegram, WhatsApp only offers typing as a
 * reaction to a specific received message. Cosmetic only — never throws.
 */
export async function markReadWithTyping(messageId: string): Promise<void> {
  if (!messageId) return;
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
