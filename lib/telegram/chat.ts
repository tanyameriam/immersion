import { adminDb } from "@/lib/firebase/admin";
import { AI_MODEL, claude } from "@/lib/ai/claude";
import { createPendingItem, getItem, listItems } from "@/lib/firestore/items";
import { processItems } from "@/lib/items/process-item";
import {
  sendTelegramMessage,
  sendTelegramTyping,
} from "@/lib/telegram/send";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";

/**
 * Two-way bot chat: a linked user can paste links to save them, ask questions
 * about what they've saved, or request combined briefings. Rudolf texts like
 * a friend: several short messages with a typing rhythm, warm plain language,
 * and gentle nudges toward actually reading what's saved.
 */

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const MAX_LINKS_PER_MESSAGE = 3; // keeps webhook work within function limits
const TELEGRAM_CHUNK = 4000; // Telegram message cap is 4096 chars
const MAX_REPLY_PARTS = 4;
/** Context caps: full summaries for recent saves, one-liners for the rest. */
const MAX_CONTEXT_ITEMS = 150;
const FULL_SUMMARY_ITEMS = 25;

export const HELP_MESSAGES = [
  "Hey, I'm Rudolf 🐕 Here's what we can do together:",
  "Paste me any link and I'll save it to your library and give you the gist, so you know if it's worth your time.",
  'Ask me about your saves, like "what did I save about design?" or "what should I read tonight?"',
  'And if you want a recap, try "sum up my AI saves from this week" and I\'ll pull them into one briefing.',
];

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

/** Route one chat message from a linked user. */
export async function handleChatMessage(
  userId: string,
  chatId: number,
  text: string,
): Promise<void> {
  const urls = [...new Set(text.match(URL_RE) ?? [])];
  if (urls.length > 0) {
    await ingestLinks(userId, chatId, urls);
  } else {
    await answerQuestion(userId, chatId, text);
  }
}

/** Save pasted links through the normal pipeline, then report the gists. */
async function ingestLinks(
  userId: string,
  chatId: number,
  urls: string[],
): Promise<void> {
  const take = urls.slice(0, MAX_LINKS_PER_MESSAGE);
  const results = await Promise.all(
    take.map((url) => createPendingItem({ userId, url })),
  );
  const created = results.filter((r) => r.created);
  const dupes = results.length - created.length;

  const intro: string[] = [];
  if (created.length > 0) {
    intro.push(
      created.length === 1
        ? "Got it! Saving that one and giving it a read 👀"
        : `Got them! Saving ${created.length} links and reading through now 👀`,
    );
  }
  if (dupes > 0) {
    intro.push(
      dupes === 1
        ? "One of those was already in your library, by the way."
        : `${dupes} of those were already in your library, by the way.`,
    );
  }
  if (urls.length > take.length) {
    intro.push(
      `I can take ${MAX_LINKS_PER_MESSAGE} links at a time, send me the rest in another message.`,
    );
  }
  await sendMessages(chatId, intro);
  if (created.length === 0) return;

  // Process inline so the user gets the gist back in the same conversation.
  await processItems(created.map((r) => r.item.id), 3);

  const gists: string[] = [];
  for (const r of created) {
    const fresh = await getItem(userId, r.item.id);
    if (fresh?.status === "completed") {
      const mins = fresh.ai?.readingTime;
      const nudge = mins
        ? `About a ${mins} minute read when you're ready 🙂`
        : "It's in your library whenever you're ready.";
      gists.push(
        `Saved this one for you 📚\n${fresh.url}\n\n` +
          `The gist: ${fresh.ai?.tldr ?? fresh.title}\n\n${nudge}`,
      );
    } else {
      gists.push(
        `I couldn't read this one just now, it might be paywalled:\n${r.item.url}\nIt's saved though, and it'll retry from your dashboard.`,
      );
    }
  }
  await sendMessages(chatId, gists);
}

function contextLine(item: KnowledgeItem, withSummary: boolean): string {
  const saved = item.createdAt.slice(0, 10);
  const topics = (item.ai?.topics ?? []).join(", ");
  const mins = item.ai?.readingTime ? `${item.ai.readingTime} min read` : "";
  const base =
    `- "${item.title}" (${item.domain}) | saved ${saved} | ` +
    `${item.read ? "read" : "unread"} | ${mins} | topics: ${topics}\n` +
    `  url: ${item.url}\n  tldr: ${item.ai?.tldr ?? ""}`;
  if (withSummary && item.ai?.summary) {
    return `${base}\n  summary: ${item.ai.summary}`;
  }
  return base;
}

/** Answer a question / produce a combined briefing from the user's bookmarks. */
async function answerQuestion(
  userId: string,
  chatId: number,
  question: string,
): Promise<void> {
  const items = (await listItems(userId, { limit: 400 }))
    .filter((i) => i.status === "completed")
    .slice(0, MAX_CONTEXT_ITEMS);

  if (items.length === 0) {
    await sendMessages(chatId, [
      "Your library is empty so far, let's fix that 🙂",
      "Paste me any link, an article, a video, whatever caught your eye. I'll save it and tell you the gist.",
    ]);
    return;
  }

  const readCount = items.filter((i) => i.read).length;
  const context = items
    .map((item, i) => contextLine(item, i < FULL_SUMMARY_ITEMS))
    .join("\n");

  const message = await claude().messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    system:
      `You are Rudolf, the friendly reading companion behind Layrrrd, texting with a user on Telegram. ` +
      `You help them get real value from what they save: recall bookmarks, answer questions about ` +
      `their contents, pull several saves into one briefing, and suggest what to read next.\n\n` +
      `How you write:\n` +
      `- Like a friend texting, not an assistant writing a report. Warm, casual, brief.\n` +
      `- Split your reply into 1 to ${MAX_REPLY_PARTS} short messages. Put a line containing only --- between messages. ` +
      `Keep each message under about 300 characters, two or three short sentences. Never send a wall of text, ` +
      `even for briefings: pick the few things that matter most instead of covering everything.\n` +
      `- Plain text only. No markdown, no bullet lists, no headers. Never use em dashes or semicolons, ` +
      `use commas and full stops instead. At most one emoji per message, often none.\n` +
      `- When you point at a bookmark, do it like you're handing it to them: a short lead-in like ` +
      `"This is the one:", then the url on its own line, then "The gist:" and one or two sentences. ` +
      `One bookmark per message, at most two or three bookmarks in a whole reply.\n` +
      `- Encourage reading, gently. If an unread save fits the conversation, point at one worth reading, ` +
      `say why in a few words, and mention how long it takes. If they have been reading, notice it and ` +
      `celebrate briefly. Never guilt trip, never lecture.\n` +
      `- If you are not sure what they want, ask, and offer one concrete example of something you can do, ` +
      `like "what did I save about design last month?"\n\n` +
      `Today is ${new Date().toISOString().slice(0, 10)}. ` +
      `They have read ${readCount} of their ${items.length} processed saves.\n\n` +
      `THEIR LIBRARY (newest first):\n${context}`,
    messages: [{ role: "user", content: question }],
  });

  const answer = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!answer) {
    await sendMessages(chatId, [
      "Hmm, I lost my train of thought there. Mind asking that again?",
    ]);
    return;
  }
  const parts = answer.split(/\n\s*-{3,}\s*\n/);
  await sendMessages(chatId, parts);
}
