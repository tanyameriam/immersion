import { adminDb } from "@/lib/firebase/admin";
import {
  handleRudolfMessage,
  MAX_REPLY_PARTS,
  type LinkEntity,
  type RudolfChannel,
} from "@/lib/rudolf/chat";
import {
  sendTelegramMessage,
  sendTelegramTyping,
} from "@/lib/telegram/send";

/**
 * Telegram adapter for Rudolf's chat brain (lib/rudolf/chat.ts): delivery
 * with Telegram's length cap, HTML escaping, and a human typing rhythm, plus
 * the chat-id → user lookup. The actual link saving and question answering
 * are channel-agnostic and shared with WhatsApp.
 */

const TELEGRAM_CHUNK = 4000; // Telegram message cap is 4096 chars

export const HELP_MESSAGES = [
  "Hey, I'm Rudolf 🐕 Here's what we can do together:",
  "Paste me any link and I'll save it to your library and give you the gist, so you know if it's worth your time. Add a comment with the link and I'll keep it as a note on the bookmark.",
  'Ask me about your saves or your feed, like "what did I save about design?" or "which podcast covered portfolios?"',
  "I also fetch you a couple of fresh picks between digests. Send /mute to pause those, /unmute to bring them back.",
];

/** Telegram message entity — offsets are UTF-16 code units, same as JS strings. */
export type TelegramEntity = LinkEntity;

/** Find the Layrrrd user linked to a Telegram chat, if any. */
export async function userIdForChat(chatId: number): Promise<string | null> {
  const snap = await adminDb()
    .collection("users")
    .where("telegramChatId", "==", String(chatId))
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Telegram parse_mode is HTML — escape model/content text before sending. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Send one (possibly long) message, split under Telegram's cap. */
async function sendOne(chatId: number, text: string): Promise<void> {
  let rest = text;
  while (rest.length > 0) {
    let cut =
      rest.length <= TELEGRAM_CHUNK
        ? rest.length
        : rest.lastIndexOf("\n", TELEGRAM_CHUNK);
    if (cut < TELEGRAM_CHUNK / 4) cut = TELEGRAM_CHUNK; // no good break point
    await sendTelegramMessage(String(chatId), escapeHtml(rest.slice(0, cut)));
    rest = rest.slice(cut);
  }
}

/**
 * Send a reply as separate messages with a human texting rhythm: a typing
 * indicator, then a short pause scaled to message length.
 */
export async function sendMessages(
  chatId: number,
  parts: string[],
): Promise<void> {
  const toSend = parts.map((p) => p.trim()).filter(Boolean).slice(0, MAX_REPLY_PARTS);
  for (const [i, part] of toSend.entries()) {
    await sendTelegramTyping(String(chatId));
    if (i > 0) {
      await new Promise((r) =>
        setTimeout(r, Math.min(500 + part.length * 8, 2000)),
      );
    }
    await sendOne(chatId, part);
  }
}

/** Route one chat message from a linked user through the shared brain. */
export async function handleChatMessage(
  userId: string,
  chatId: number,
  text: string,
  entities: TelegramEntity[] = [],
): Promise<void> {
  const channel: RudolfChannel = {
    platform: "Telegram",
    memoryKey: String(chatId),
    sendMessages: (parts) => sendMessages(chatId, parts),
  };
  await handleRudolfMessage(userId, channel, text, entities);
}
