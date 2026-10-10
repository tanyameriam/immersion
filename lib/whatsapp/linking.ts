import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  handleChatMessage,
  HELP_MESSAGES,
  sendMessages,
  userIdForWaId,
} from "@/lib/whatsapp/chat";
import { traceChat } from "@/lib/rudolf/trace";
import { markReadWithTyping, sendWhatsAppMessage } from "@/lib/whatsapp/send";

/**
 * WhatsApp account linking. Like Telegram, the business number can only chat
 * with a user after that user messages it first, and we only learn who they
 * are from the inbound wa_id. So linking works via a wa.me link: we mint a
 * one-time code, the user opens wa.me/<number>?text=connect%20<code>, sends
 * the prefilled message, and we store the sender's wa_id on the matching
 * profile. The user never types their phone number into the app.
 */

const CODES_COLLECTION = "whatsappLinkCodes";
const CODE_TTL_MS = 15 * 60 * 1000;
const CONNECT_RE = /^\s*connect\s+([0-9a-f]{16})\b/i;

/** Minimal shape of the Cloud API webhook payload pieces we care about.
 * A tap on a template's quick-reply button (the digest ask) arrives as
 * type "button"; a tap on an interactive reply button as "interactive". */
type WhatsAppMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string } };
};
export type WhatsAppWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WhatsAppMessage[];
      };
    }[];
  }[];
};

/** The business number users message, digits only, for wa.me links. */
export function getBusinessNumber(): string | null {
  const raw = process.env.WHATSAPP_BUSINESS_NUMBER ?? "";
  const digits = raw.replace(/\D/g, "");
  return digits || null;
}

/** Mint a short-lived one-time code tying a connect message to this user. */
export async function createLinkCode(userId: string): Promise<string> {
  const code = randomBytes(8).toString("hex");
  await adminDb()
    .collection(CODES_COLLECTION)
    .doc(code)
    .set({ userId, createdAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Redeem a "connect <code>" message: store the wa_id, confirm in the chat. */
async function redeemLinkCode(
  code: string,
  waId: string,
  name?: string,
): Promise<boolean> {
  const ref = adminDb().collection(CODES_COLLECTION).doc(code.toLowerCase());
  const snap = await ref.get();
  const data = snap.data();
  if (!data || data.expiresAt < Date.now()) {
    await sendMessages(waId, [
      "Hmm, that connect link has expired.",
      "No worries though. Open Layrrrd, tap Connect WhatsApp again, and you'll get a fresh one.",
    ]);
    return false;
  }

  await adminDb()
    .collection("users")
    .doc(data.userId)
    .set(
      {
        whatsappWaId: waId,
        ...(name ? { whatsappName: name } : {}),
        whatsappLastInboundAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  await ref.delete();
  await sendMessages(waId, [
    "You're in! 🎉",
    "This chat is now linked to your Layrrrd account.",
    "Just talk to me. Paste any link to save it, or ask me about your saves. Send \"help\" anytime for ideas.",
  ]);
  return true;
}

/** Meta's standard opt-out words. Exact match only, so a chat message like
 * "stop saving podcasts" still reaches Rudolf. */
const STOP_RE = /^\s*(stop|unsubscribe)\s*[.!]?\s*$/i;

/** Honor an opt-out: stop WhatsApp digest asks (switching the digest back
 * to email) and drop any ask still waiting for an answer. Chat keeps
 * working - the user can still message Rudolf whenever they like. */
async function optOut(userId: string, waId: string): Promise<void> {
  const ref = adminDb().collection("users").doc(userId);
  const wasWhatsApp =
    (await ref.get()).data()?.notificationPreference === "whatsapp";
  await ref.set(
    {
      ...(wasWhatsApp ? { notificationPreference: "email" } : {}),
      pendingDigest: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await sendMessages(waId, [
    wasWhatsApp
      ? "Done, no more digest messages here. Your weekly digest goes to your email instead."
      : "Got it, I won't send you anything here unless you message me first.",
    "You can still chat with me anytime, and switch back under Profile → Newsletter Delivery.",
  ]);
}

const CONNECT_MESSAGES = [
  "Hey! I'm Rudolf, the Layrrrd reading buddy 🐕",
  "To get started, open Layrrrd and tap Connect WhatsApp in your delivery settings. Then we can chat right here.",
];

/** Handle one inbound WhatsApp message. Returns true if it completed a link. */
async function processMessage(
  message: WhatsAppMessage,
  name?: string,
): Promise<boolean> {
  const waId = message.from;
  if (!waId) return false;

  // Mark it read and show typing while we work — cosmetic, never blocking.
  if (message.id) await markReadWithTyping(message.id);

  const text = (
    message.type === "text"
      ? message.text?.body
      : message.type === "button"
        ? message.button?.text
        : message.type === "interactive"
          ? message.interactive?.button_reply?.title
          : undefined
  )?.trim();
  const userId = await userIdForWaId(waId);

  // Any inbound message opens (or extends) Meta's free 24-hour window; the
  // digest cron reads this to skip the paid template when it can.
  if (userId) {
    await adminDb()
      .collection("users")
      .doc(userId)
      .set({ whatsappLastInboundAt: new Date().toISOString() }, { merge: true });
  }

  if (!text) {
    // Phase 1 is text-only: no images, voice notes, or documents yet.
    await sendMessages(
      waId,
      userId
        ? [
            "I can only read text and links here for now.",
            "Paste me a link, or ask me about your saves 🙂",
          ]
        : CONNECT_MESSAGES,
    );
    return false;
  }

  const match = text.match(CONNECT_RE);
  if (match) return redeemLinkCode(match[1], waId, name);

  if (/^\/?(help|start)\b/i.test(text)) {
    await sendMessages(waId, userId ? HELP_MESSAGES : CONNECT_MESSAGES);
    return false;
  }

  if (!userId) {
    await sendMessages(waId, CONNECT_MESSAGES);
    return false;
  }

  if (STOP_RE.test(text)) {
    await optOut(userId, waId);
    return false;
  }

  // The receipt is what makes a screenshot of the failure reply actionable:
  // the ref below is the id of the botEvents doc holding the whole interaction.
  const result = await traceChat(
    {
      userId,
      channel: "WhatsApp",
      memoryKey: `wa:${waId}`,
      inboundText: text,
    },
    () => handleChatMessage(userId, waId, text),
  );
  if (!result.ok) {
    await sendWhatsAppMessage(
      waId,
      "Oops, something hiccuped on my side. Give it another go in a moment? " +
        `(ref: ${result.ref})`,
    );
  }
  return false;
}

/**
 * Process one webhook delivery from the Cloud API: every inbound message in
 * every entry/change. Status updates (sent/delivered/read receipts) carry no
 * `messages` array and fall through untouched. Returns how many account
 * links it completed.
 */
export async function processWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
): Promise<number> {
  let linked = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const message of value?.messages ?? []) {
        const name = value?.contacts?.find(
          (c) => c.wa_id === message.from,
        )?.profile?.name;
        if (await processMessage(message, name)) linked++;
      }
    }
  }
  return linked;
}
