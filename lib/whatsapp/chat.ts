import { adminDb } from "@/lib/firebase/admin";
import {
  handleRudolfMessage,
  MAX_REPLY_PARTS,
  type RudolfChannel,
} from "@/lib/rudolf/chat";
import { maxTextLength, sendWhatsAppMessage } from "@/lib/whatsapp/send";

/**
 * WhatsApp adapter for Rudolf's chat brain (lib/rudolf/chat.ts): delivery
 * with WhatsApp's length cap and a human texting rhythm, plus the wa_id →
 * user lookup. Link saving and question answering are channel-agnostic and
 * shared with Telegram.
 */


export const HELP_MESSAGES = [
  "Hey, I'm Rudolf 🐕 Here's what we can do together:",
  "Paste me any link and I'll save it to your Layrrrd library and give you the gist, so you know if it's worth your time. Add a comment with the link and I'll keep it as a note on the bookmark.",
  'Ask me about your saves or your feed, like "what did I save about design?" or "which podcast covered portfolios?"',
];

/** Find the Layrrrd user linked to a WhatsApp account, if any. */
export async function userIdForWaId(waId: string): Promise<string | null> {
  const snap = await adminDb()
    .collection("users")
    .where("whatsappWaId", "==", waId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Send one (possibly long) message, split under the provider's cap. */
async function sendOne(waId: string, text: string): Promise<void> {
  const chunk = maxTextLength();
  let rest = text;
  while (rest.length > 0) {
    let cut =
      rest.length <= chunk
        ? rest.length
        : rest.lastIndexOf("\n", chunk);
    if (cut < chunk / 4) cut = chunk; // no good break point
    await sendWhatsAppMessage(waId, rest.slice(0, cut));
    rest = rest.slice(cut);
  }
}

/** Deliver parts with a human texting rhythm: a short pause scaled to
 * message length. (WhatsApp's typing indicator is tied to marking the
 * inbound message read, which the webhook handler does once.) */
async function deliver(waId: string, parts: string[]): Promise<void> {
  for (const [i, part] of parts.entries()) {
    if (i > 0) {
      await new Promise((r) =>
        setTimeout(r, Math.min(500 + part.length * 8, 2000)),
      );
    }
    await sendOne(waId, part);
  }
}

/** Send a reply as separate messages. */
export async function sendMessages(
  waId: string,
  parts: string[],
): Promise<void> {
  const toSend = parts.map((p) => p.trim()).filter(Boolean).slice(0, MAX_REPLY_PARTS);
  await deliver(waId, toSend);
}

/** Digest parts arrive as Telegram-style HTML (see lib/digest/build.ts).
 * WhatsApp has no HTML mode, so convert: links become "title" then the url
 * on its own line, bold/italic become WhatsApp's own markers, and the
 * build-time entity escaping is undone last. */
export function htmlToWhatsAppText(text: string): string {
  return text
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, "$2\n$1")
    .replace(/<b>([\s\S]*?)<\/b>/g, "*$1*")
    .replace(/<i>([\s\S]*?)<\/i>/g, "_$1_")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Send pre-rendered digest parts, converted to WhatsApp formatting. No
 * reply-part cap - the digest's section count is fixed at build time. */
export async function sendFormattedMessages(
  waId: string,
  parts: string[],
): Promise<void> {
  const toSend = parts
    .map((p) => htmlToWhatsAppText(p).trim())
    .filter(Boolean);
  await deliver(waId, toSend);
}

/** Route one chat message from a linked user through the shared brain. */
export async function handleChatMessage(
  userId: string,
  waId: string,
  text: string,
): Promise<void> {
  const channel: RudolfChannel = {
    platform: "WhatsApp",
    memoryKey: `wa:${waId}`,
    sendMessages: (parts) => sendMessages(waId, parts),
    sendFormattedMessages: (parts) => sendFormattedMessages(waId, parts),
  };
  await handleRudolfMessage(userId, channel, text);
}
