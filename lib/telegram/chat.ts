import { adminDb } from "@/lib/firebase/admin";
import { AI_MODEL, claude } from "@/lib/ai/claude";
import { createPendingItem, getItem, listItems } from "@/lib/firestore/items";
import { processItems } from "@/lib/items/process-item";
import { sendTelegramMessage } from "@/lib/telegram/send";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";

/**
 * Two-way bot chat: a linked user can paste links to save them, ask questions
 * about what they've saved, or request combined summaries across bookmarks.
 */

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const MAX_LINKS_PER_MESSAGE = 3; // keeps webhook work within function limits
const TELEGRAM_CHUNK = 4000; // Telegram message cap is 4096 chars
/** Context caps: full summaries for recent saves, one-liners for the rest. */
const MAX_CONTEXT_ITEMS = 150;
const FULL_SUMMARY_ITEMS = 25;

export const HELP_TEXT = [
  "Here's what I can do:",
  "",
  "📌 Save — paste any link (up to 3 per message) and I'll add it to your Layrrrd bookmarks and summarize it.",
  "🔎 Ask — “what did I save about design systems?”, “what's still unread from this week?”",
  "📝 Combine — “give me one briefing of my AI bookmarks from this month”.",
  "",
  "Your weekly digest lands here too.",
].join("\n");

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

/** Send a (possibly long) plain-text reply, split under Telegram's cap. */
async function reply(chatId: number, text: string): Promise<void> {
  let rest = text;
  while (rest.length > 0) {
    let cut = rest.length <= TELEGRAM_CHUNK ? rest.length : rest.lastIndexOf("\n", TELEGRAM_CHUNK);
    if (cut < TELEGRAM_CHUNK / 4) cut = TELEGRAM_CHUNK; // no good break point
    await sendTelegramMessage(String(chatId), escapeHtml(rest.slice(0, cut)));
    rest = rest.slice(cut);
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

  const parts: string[] = [];
  if (created.length > 0) {
    parts.push(
      `📌 Saved ${created.length} link${created.length === 1 ? "" : "s"} to your bookmarks — summarizing now…`,
    );
  }
  if (dupes > 0) parts.push(`${dupes} already in your library.`);
  if (urls.length > take.length) {
    parts.push(`(I take up to ${MAX_LINKS_PER_MESSAGE} links per message — send the rest separately.)`);
  }
  await reply(chatId, parts.join(" "));
  if (created.length === 0) return;

  // Process inline so the user gets the gist back in the same conversation.
  await processItems(created.map((r) => r.item.id), 3);

  const gists: string[] = [];
  for (const r of created) {
    const fresh = await getItem(userId, r.item.id);
    if (fresh?.status === "completed") {
      gists.push(`• ${fresh.title}\n${fresh.ai?.tldr ?? ""}`);
    } else {
      gists.push(
        `• ${r.item.url}\nCouldn't read this one yet (it may be paywalled) — it'll retry from your dashboard.`,
      );
    }
  }
  await reply(chatId, `Done! The gist:\n\n${gists.join("\n\n")}`);
}

function contextLine(item: KnowledgeItem, withSummary: boolean): string {
  const saved = item.createdAt.slice(0, 10);
  const topics = (item.ai?.topics ?? []).join(", ");
  const base =
    `- "${item.title}" (${item.domain}) | saved ${saved} | ` +
    `${item.read ? "read" : "unread"} | topics: ${topics}\n` +
    `  url: ${item.url}\n  tldr: ${item.ai?.tldr ?? ""}`;
  if (withSummary && item.ai?.summary) {
    return `${base}\n  summary: ${item.ai.summary}`;
  }
  return base;
}

/** Answer a question / produce a combined summary from the user's bookmarks. */
async function answerQuestion(
  userId: string,
  chatId: number,
  question: string,
): Promise<void> {
  const items = (await listItems(userId, { limit: 400 }))
    .filter((i) => i.status === "completed")
    .slice(0, MAX_CONTEXT_ITEMS);

  if (items.length === 0) {
    await reply(
      chatId,
      "You don't have any processed bookmarks yet — paste a link here or save one from the dashboard, and then ask me anything about it.",
    );
    return;
  }

  const context = items
    .map((item, i) => contextLine(item, i < FULL_SUMMARY_ITEMS))
    .join("\n");

  const message = await claude().messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    system:
      `You are Rudolf, the Layrrrd bookmarks assistant, chatting with a user on Telegram. ` +
      `Answer using the user's saved bookmarks listed below. You can recall and find ` +
      `bookmarks, answer questions about their contents, produce combined summaries or ` +
      `briefings across several bookmarks, and suggest what to read next. If asked for ` +
      `something unrelated to their bookmarks, briefly say what you can help with instead. ` +
      `Style: plain text only (no markdown or HTML), concise and friendly, include the url ` +
      `when you reference a specific bookmark, stay under 3000 characters.\n\n` +
      `Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +
      `USER'S BOOKMARKS (newest first):\n${context}`,
    messages: [{ role: "user", content: question }],
  });

  const answer = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  await reply(
    chatId,
    answer || "Hmm, I couldn't come up with an answer — try rephrasing?",
  );
}
