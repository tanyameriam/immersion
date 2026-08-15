import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  handleChatMessage,
  HELP_MESSAGES,
  sendMessages,
  userIdForChat,
  type TelegramEntity,
} from "@/lib/telegram/chat";
import { traceChat } from "@/lib/rudolf/trace";
import { sendTelegramMessage } from "@/lib/telegram/send";

/**
 * Telegram account linking. Telegram bots can only message a user AFTER that
 * user has messaged the bot first, and only by numeric chat id — a username
 * is not enough. So linking works via a deep link: we mint a one-time code,
 * the user opens t.me/<bot>?start=<code>, Telegram sends us "/start <code>",
 * and we store the sender's chat id on the matching profile.
 */

const CODES_COLLECTION = "telegramLinkCodes";
const CODE_TTL_MS = 15 * 60 * 1000;

/** Minimal shape of a Telegram update we care about. Media shares from other
 * apps arrive as `caption` + `caption_entities` instead of `text`. */
type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    caption?: string;
    entities?: TelegramEntity[];
    caption_entities?: TelegramEntity[];
    chat?: { id?: number };
  };
};

let cachedBotUsername: string | null = null;

/** The bot's @username, discovered from the bot token via getMe (cached). */
export async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    cachedBotUsername = data?.result?.username ?? null;
  } catch (err) {
    console.error("Telegram getMe failed", err);
  }
  return cachedBotUsername;
}

/** Mint a short-lived one-time code tying a deep-link tap to this user. */
export async function createLinkCode(userId: string): Promise<string> {
  const code = randomBytes(8).toString("hex");
  await adminDb()
    .collection(CODES_COLLECTION)
    .doc(code)
    .set({ userId, createdAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Redeem a "/start <code>" tap: store the chat id, confirm in the chat. */
async function redeemLinkCode(code: string, chatId: number): Promise<boolean> {
  const ref = adminDb().collection(CODES_COLLECTION).doc(code);
  const snap = await ref.get();
  const data = snap.data();
  if (!data || data.expiresAt < Date.now()) {
    await sendMessages(chatId, [
      "Hmm, that connect link has expired.",
      "No worries though. Open Layrrrd, tap Connect Telegram again, and you'll get a fresh one.",
    ]);
    return false;
  }

  await adminDb().collection("users").doc(data.userId).set(
    {
      telegramChatId: String(chatId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await ref.delete();
  await sendMessages(chatId, [
    "You're in! 🎉",
    "This chat is now linked to your Layrrrd account, so your weekly digest lands right here.",
    "And you can just talk to me. Paste any link to save it, or ask me about your saves. Send /help anytime for ideas.",
  ]);
  return true;
}

const CONNECT_MESSAGES = [
  "Hey! I'm Rudolf, the Layrrrd reading buddy 🐕",
  "To get started, open Layrrrd and tap Connect Telegram in your delivery settings. Then we can chat right here.",
];

/**
 * Process one Telegram update (from the webhook or the dev poll route):
 * link-code redemptions, /help, and — for linked users — two-way chat
 * (paste links to save them, ask about saved bookmarks, request combined
 * summaries). Returns true if it completed an account link.
 */
export async function processTelegramUpdate(
  update: TelegramUpdate,
): Promise<boolean> {
  const text = update.message?.text ?? update.message?.caption;
  const entities =
    update.message?.entities ?? update.message?.caption_entities ?? [];
  const chatId = update.message?.chat?.id;
  if (!text || !chatId) return false;

  const match = text.match(/^\/start[ =](\S+)/);
  if (match) return redeemLinkCode(match[1], chatId);

  const userId = await userIdForChat(chatId);

  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMessages(chatId, userId ? HELP_MESSAGES : CONNECT_MESSAGES);
    return false;
  }

  if (!userId) {
    await sendMessages(chatId, CONNECT_MESSAGES);
    return false;
  }

  // The receipt is what makes a screenshot of the failure reply actionable:
  // the ref below is the id of the botEvents doc holding the whole interaction.
  const result = await traceChat(
    {
      userId,
      channel: "Telegram",
      memoryKey: String(chatId),
      inboundText: text,
    },
    () => handleChatMessage(userId, chatId, text, entities),
  );
  if (!result.ok) {
    await sendTelegramMessage(
      String(chatId),
      "Oops, something hiccuped on my side. Give it another go in a moment? " +
        `(ref: ${result.ref})`,
    );
  }
  return false;
}
