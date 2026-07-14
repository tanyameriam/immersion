import { adminDb } from "@/lib/firebase/admin";
import {
  handleRudolfMessage,
  MAX_REPLY_PARTS,
  type RudolfChannel,
} from "@/lib/rudolf/chat";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

/**
 * WhatsApp adapter for Rudolf's chat brain (lib/rudolf/chat.ts): delivery
 * with WhatsApp's length cap and a human texting rhythm, plus the wa_id →
 * user lookup. Link saving and question answering are channel-agnostic and
 * shared with Telegram.
 */

const WHATSAPP_CHUNK = 4000; // WhatsApp text body cap is 4096 chars

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

/** Send one (possibly long) message, split under WhatsApp's cap. */
async function sendOne(waId: string, text: string): Promise<void> {
  let rest = text;
  while (rest.length > 0) {
    let cut =
      rest.length <= WHATSAPP_CHUNK
        ? rest.length
        : rest.lastIndexOf("\n", WHATSAPP_CHUNK);
    if (cut < WHATSAPP_CHUNK / 4) cut = WHATSAPP_CHUNK; // no good break point
    await sendWhatsAppMessage(waId, rest.slice(0, cut));
    rest = rest.slice(cut);
  }
}

/**
 * Send a reply as separate messages with a human texting rhythm: a short
 * pause scaled to message length. (WhatsApp's typing indicator is tied to
 * marking the inbound message read, which the webhook handler does once.)
 */
export async function sendMessages(
  waId: string,
  parts: string[],
): Promise<void> {
  const toSend = parts.map((p) => p.trim()).filter(Boolean).slice(0, MAX_REPLY_PARTS);
  for (const [i, part] of toSend.entries()) {
    if (i > 0) {
      await new Promise((r) =>
        setTimeout(r, Math.min(500 + part.length * 8, 2000)),
      );
    }
    await sendOne(waId, part);
  }
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
  };
  await handleRudolfMessage(userId, channel, text);
}
