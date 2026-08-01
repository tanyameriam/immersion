import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { AI_MODEL, claude } from "@/lib/ai/claude";
import { limitsFor } from "@/lib/billing/config";
import { getUserPlan } from "@/lib/billing/plan";
import { meterQuestion } from "@/lib/billing/playtime";
import {
  countItems,
  createPendingItem,
  getItem,
  listItems,
  searchItems,
} from "@/lib/firestore/items";
import { processItems } from "@/lib/items/process-item";
import { durationLabel, savedNudge, toMedium } from "@/lib/medium-label";
import { getCachedFeed, type FeedEntry } from "@/lib/rudolf/feed";
import {
  getRecentMentions,
  rememberMentions,
  type Mention,
} from "@/lib/rudolf/memory";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";

/**
 * Rudolf's channel-agnostic chat brain, shared by Telegram and WhatsApp: a
 * linked user can paste links to save them, ask questions about what they've
 * saved, or request combined briefings. Rudolf texts like a friend: several
 * short messages with a typing rhythm, warm plain language, and gentle nudges
 * toward actually reading what's saved. Each channel supplies a thin adapter
 * for delivery (its own length caps, formatting, and typing mechanics).
 */

export const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const MAX_LINKS_PER_MESSAGE = 3; // keeps webhook work within function limits
export const MAX_REPLY_PARTS = 4;
/** Context caps: full summaries for the most relevant saves, one-liners for
 * the rest. Keyword-matched items fill the context first, so a question about
 * an old save is answerable even in a multi-thousand-item library. */
const MAX_CONTEXT_ITEMS = 100;
const FULL_SUMMARY_ITEMS = 25;
const RECENCY_ITEMS = 100;
const MAX_NOTE_LENGTH = 500;

/** How a channel delivers Rudolf's replies and identifies the conversation. */
export type RudolfChannel = {
  /** Named in the system prompt: "texting with a user on <platform>". */
  platform: "Telegram" | "WhatsApp";
  /** Stable key for short-term mention memory (chat id / "wa:<waId>"). */
  memoryKey: string;
  /** Deliver reply parts with the channel's own rhythm and length caps. */
  sendMessages: (parts: string[]) => Promise<void>;
};

/** Message link entity (Telegram-style) — offsets are UTF-16 code units,
 * same as JS strings. Channels without entities just omit them. */
export type LinkEntity = {
  type: string;
  offset: number;
  length: number;
  /** Present on "text_link" entities: the URL behind the anchor text. */
  url?: string;
};

/**
 * Split a message into the links to save and the user's own words. Handles
 * plain pasted URLs and share-target messages where the URL hides behind
 * anchor text (a "text_link" entity). Whatever text remains after removing
 * the links becomes a note stored on the bookmark.
 */
export function extractUrlsAndNote(
  text: string,
  entities: LinkEntity[] = [],
): { urls: string[]; note?: string } {
  const plainUrls = text.match(URL_RE) ?? [];
  const linkEntities = entities.filter((e) => e.type === "text_link" && e.url);

  const urls = [...new Set([...plainUrls, ...linkEntities.map((e) => e.url!)])];

  // The note is the message minus every URL span and every text_link anchor.
  let note = text;
  for (const e of [...linkEntities].sort((a, b) => b.offset - a.offset)) {
    note = note.slice(0, e.offset) + note.slice(e.offset + e.length);
  }
  note = note.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
  if (note.length > MAX_NOTE_LENGTH) {
    note = `${note.slice(0, MAX_NOTE_LENGTH).trimEnd()}…`;
  }
  return { urls, note: note || undefined };
}

const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.layrrrd.com"}/dashboard/profile`;
const foundingUrl = "https://layrrrd.com/founding-membership";

function sleepyWarning(remainingMs: number): string {
  const mins = Math.max(1, Math.round(remainingMs / 60000));
  return (
    `Quick woof from me: I'm getting a little sleepy, about ${mins} ` +
    `minutes of play left today. A biscuit keeps me going for 15 more ` +
    `minutes if you want to keep chatting: ${upgradeUrl}`
  );
}

const SLEEP_MESSAGES = [
  "I'm all played out for today, so I'm curling up for a nap 😴",
  `Your saves are safe and you can keep sending me links, I'll tuck them ` +
    `into your library while I snooze. To wake me up, grab me a biscuit ` +
    `here: ${upgradeUrl}. Or join as a founding member for unlimited play, ` +
    `forever: ${foundingUrl}`,
];

/** A digest rendered and ready to go, withheld until the user says yes -
 * see the cron job in app/api/cron/weekly-digest/route.ts. */
type PendingDigest = {
  askedAt: string;
  parts: string[];
  recs: { url: string; title: string }[];
};

const DIGEST_CONSENT_EXPIRY_MS = 48 * 60 * 60 * 1000; // stale "this week" past this
const DIGEST_YES_RE = /^(y|yes|yeah|yep|yup|sure|ok|okay|please|go ahead|send it)\b/i;
const DIGEST_NO_RE = /^(n|no|nope|nah|skip|later|not now)\b/i;

/**
 * If this user has an outstanding "want your digest?" ask and the message
 * is a clear yes/no, resolve it (send the withheld content, or acknowledge
 * the decline) and report the message as handled. Anything ambiguous falls
 * through to normal chat handling instead of blocking on an answer - the
 * ask just stays open for a later message to resolve.
 */
async function tryResolveDigestConsent(
  userId: string,
  channel: RudolfChannel,
  text: string,
): Promise<boolean> {
  const ref = adminDb().collection("users").doc(userId);
  const snap = await ref.get();
  const pending = snap.data()?.pendingDigest as PendingDigest | undefined;
  if (!pending) return false;

  const askedAt = Date.parse(pending.askedAt);
  if (!Number.isFinite(askedAt) || Date.now() - askedAt > DIGEST_CONSENT_EXPIRY_MS) {
    // Too stale to deliver as "this week" - drop it quietly rather than
    // answer for the user or surface old content out of context.
    await ref.update({ pendingDigest: FieldValue.delete() });
    return false;
  }

  const trimmed = text.trim();
  if (DIGEST_YES_RE.test(trimmed)) {
    await ref.update({
      pendingDigest: FieldValue.delete(),
      lastDigestSentAt: new Date().toISOString(),
    });
    await channel.sendMessages(pending.parts);
    if (pending.recs.length) {
      await rememberMentions(channel.memoryKey, pending.recs);
    }
    return true;
  }
  if (DIGEST_NO_RE.test(trimmed)) {
    await ref.update({ pendingDigest: FieldValue.delete() });
    await channel.sendMessages(["No problem, I'll check back next week 🐕"]);
    return true;
  }
  return false;
}

/** Route one chat message from a linked user. */
export async function handleRudolfMessage(
  userId: string,
  channel: RudolfChannel,
  text: string,
  entities: LinkEntity[] = [],
): Promise<void> {
  if (await tryResolveDigestConsent(userId, channel, text)) return;

  const limits = limitsFor(await getUserPlan(userId));

  const { urls, note } = extractUrlsAndNote(text, entities);
  if (urls.length > 0) {
    // Saving links is never metered: the library keeps working even while
    // Rudolf is out of play time.
    if (
      limits.maxItems !== null &&
      (await countItems(userId)) >= limits.maxItems
    ) {
      await channel.sendMessages([
        `Your free shelf is full (${limits.maxItems} saves). Upgrade to keep collecting: ${upgradeUrl}`,
      ]);
      return;
    }
    await ingestLinks(userId, channel, urls, note);
    return;
  }

  // Questions are Rudolf's "play time". Paid members play unlimited; the
  // free plan gets a daily allowance topped up by purchased biscuits.
  if (limits.rudolfPlaytime === "metered") {
    const meter = await meterQuestion(userId);
    if (!meter.allowed) {
      if (meter.shouldSendSleepMessage) {
        await channel.sendMessages(SLEEP_MESSAGES);
      }
      return; // already said goodnight today: stay asleep quietly
    }
    await answerQuestion(userId, channel, text);
    if (meter.shouldWarn) {
      await channel.sendMessages([sleepyWarning(meter.remainingMs)]);
    }
    return;
  }

  await answerQuestion(userId, channel, text);
}

/** Save pasted links through the normal pipeline, then report the gists. */
async function ingestLinks(
  userId: string,
  channel: RudolfChannel,
  urls: string[],
  note?: string,
): Promise<void> {
  const take = urls.slice(0, MAX_LINKS_PER_MESSAGE);
  const results = await Promise.all(
    take.map((url) => createPendingItem({ userId, url, note })),
  );
  const created = results.filter((r) => r.created);
  const dupes = results.length - created.length;

  const intro: string[] = [];
  if (created.length > 0) {
    intro.push(
      created.length === 1
        ? "Fetched it! Saving that one and giving it a good read 👀"
        : `Fetched them! Saving ${created.length} links and reading through now 👀`,
    );
  }
  if (dupes > 0) {
    intro.push(
      dupes === 1
        ? note
          ? "That one was already in your library, so I tucked your comment onto it."
          : "One of those was already in your library, by the way."
        : `${dupes} of those were already in your library, by the way.`,
    );
  }
  if (note && created.length > 0) {
    intro.push("Kept your comment too, it's on the bookmark as a note.");
  }
  if (urls.length > take.length) {
    intro.push(
      `I can carry ${MAX_LINKS_PER_MESSAGE} links at a time, send me the rest in another message.`,
    );
  }
  await channel.sendMessages(intro);
  if (created.length === 0) return;

  // Process inline so the user gets the gist back in the same conversation.
  await processItems(created.map((r) => r.item.id), 3);

  const gists: string[] = [];
  for (const r of created) {
    const fresh = await getItem(userId, r.item.id);
    if (fresh?.status === "completed" && fresh.blocked) {
      // The site served a bot-challenge or login/signup wall instead of the
      // article - there's nothing honest to summarize yet.
      gists.push(
        `Saved the link, but that site blocked me from reading it 🤖\n${fresh.url}\n\n` +
          `It's a bot-check or a login/signup wall. Open it in your own browser (already signed in, past the check) and save it from the Layrrrd extension instead - it reads the page you're already looking at.`,
      );
    } else if (fresh?.status === "completed" && fresh.ai?.degraded) {
      // Saved, but the site only let us read the basics - be honest about it.
      gists.push(
        `Saved it 📚\n${fresh.url}\n\n` +
          `I could only read the basics, the site keeps the full content behind a login or paywall. ` +
          `Here is what I got: ${fresh.ai?.tldr ?? fresh.title}`,
      );
    } else if (fresh?.status === "completed") {
      const nudge = savedNudge(fresh.type, fresh.ai?.readingTime);
      gists.push(
        `Saved this one for you 📚\n${fresh.url}\n\n` +
          `The gist: ${fresh.ai?.tldr ?? fresh.title}\n\n${nudge}`,
      );
    } else {
      // Metadata salvage means we usually still know what the page is called.
      const title =
        fresh?.title && fresh.title !== fresh.url ? `"${fresh.title}"` : null;
      gists.push(
        (title
          ? `I couldn't fully read ${title}, it might be paywalled:\n`
          : `I couldn't read this one just now, it might be paywalled:\n`) +
          `${r.item.url}\n` +
          `It's saved with what I could grab, and it'll retry from your dashboard.`,
      );
    }
  }
  await channel.sendMessages(gists);
}

function contextLine(item: KnowledgeItem, withSummary: boolean): string {
  const saved = item.createdAt.slice(0, 10);
  const topics = (item.ai?.topics ?? []).join(", ");
  const medium = toMedium(item.type);
  const mins = durationLabel(item.type, item.ai?.readingTime);
  const base =
    `- "${item.title}" (${item.domain}, ${medium}) | saved ${saved} | ` +
    `${item.read ? "finished" : "not finished"} | ${mins} | topics: ${topics}\n` +
    `  url: ${item.url}\n  tldr: ${item.ai?.tldr ?? ""}`;
  if (withSummary && item.ai?.summary) {
    return `${base}\n  summary: ${item.ai.summary}`;
  }
  return base;
}

function feedLine(e: FeedEntry): string {
  const label = durationLabel(e.contentType, e.readingTime);
  const mins = label ? `, ${label}` : "";
  return (
    `- "${e.title}" (${e.source}, ${e.contentType}${mins}) | why: ${e.reason}\n` +
    `  url: ${e.url}\n  tldr: ${e.tldr}`
  );
}

function mentionLine(m: Mention): string {
  return `- "${m.title}" ${m.url} (sent ${m.at.slice(0, 10)})`;
}

/** Words too generic to be worth an indexed lookup. */
const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "what",
  "when",
  "where",
  "which",
  "about",
  "from",
  "have",
  "with",
  "was",
  "you",
  "did",
  "saved",
  "save",
  "read",
  "watch",
  "listen",
  "something",
  "anything",
]);

/**
 * Pull search terms out of the user's question with one cheap Claude call
 * (synonyms included, so "feeling stuck at work" can match "career" saves).
 * Falls back to naive tokenization if the call fails, and to nothing when the
 * message has no usable content words.
 */
async function extractQueryTerms(question: string): Promise<string[]> {
  const naive = () =>
    question
      .toLowerCase()
      .split(/[^\p{L}\p{N}-]+/u)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
      .slice(0, 8);
  try {
    const message = await claude().messages.create({
      model: AI_MODEL,
      max_tokens: 150,
      system:
        "Extract search keywords from the user's message about their saved bookmarks. " +
        'Reply with ONLY a JSON object like {"terms": ["keyword", ...]}: up to 8 lowercase ' +
        "single words or short phrases, including close synonyms of the main concepts. " +
        "Reply with {\"terms\": []} if the message is small talk with no searchable topic.",
      messages: [{ role: "user", content: question }],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms.map((t: unknown) => String(t).toLowerCase().trim()).filter(Boolean)
      : [];
    return terms.length > 0 ? terms.slice(0, 8) : naive();
  } catch {
    return naive();
  }
}

/** Answer a question / briefing request from the user's saves and their feed. */
async function answerQuestion(
  userId: string,
  channel: RudolfChannel,
  question: string,
): Promise<void> {
  const terms = await extractQueryTerms(question);

  // Keyword/topic matches first (reaches saves of any age), recency for
  // conversational context. Feed and recent-mention context are always
  // optional — failures fall back to a bookmarks-only answer.
  const [matched, recent, feed, mentions] = await Promise.all([
    terms.length > 0
      ? searchItems(userId, terms, { limitPerField: 60 }).catch(() => [])
      : Promise.resolve([]),
    listItems(userId, { limit: RECENCY_ITEMS }),
    getCachedFeed(userId).catch(() => []),
    getRecentMentions(channel.memoryKey).catch(() => []),
  ]);

  const seen = new Set<string>();
  const items: KnowledgeItem[] = [];
  for (const item of [...matched, ...recent]) {
    if (item.status !== "completed" || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_CONTEXT_ITEMS) break;
  }

  if (items.length === 0 && feed.length === 0) {
    await channel.sendMessages([
      "Your library is empty so far, let's fix that 🙂",
      "Paste me any link, an article, a video, whatever caught your eye. I'll save it and tell you the gist.",
    ]);
    return;
  }

  // Their preference set shapes every suggestion: lean into stated
  // interests, keep hidden topics out unless they ask by name.
  const profile =
    (await adminDb().collection("users").doc(userId).get()).data() ?? {};
  const preferredTopics: string[] = profile.preferredTopics ?? [];
  const mutedTopics: string[] = profile.mutedTopics ?? [];

  const readCount = items.filter((i) => i.read).length;
  const context = items
    .map((item, i) => contextLine(item, i < FULL_SUMMARY_ITEMS))
    .join("\n");
  const feedContext = feed.map(feedLine).join("\n");
  const mentionsContext = mentions.map(mentionLine).join("\n");

  const message = await claude().messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    system:
      `You are Rudolf, the friendly dog behind Layrrrd, texting with a user on ${channel.platform}. ` +
      `You help them get real value from what they save and from the fresh picks in their feed: ` +
      `recall bookmarks, answer questions about their contents, pull several saves into one briefing, ` +
      `and suggest what to read, watch or listen to next.\n\n` +
      `How you write:\n` +
      `- Like a friend texting, not an assistant writing a report. Warm, casual, brief.\n` +
      `- You are a dog, lightly. At most one playful dog touch in a whole reply, a woof, a fetch pun, ` +
      `a wagging tail. Often none, and never when the topic is serious. The answer always comes first.\n` +
      `- Split your reply into 1 to ${MAX_REPLY_PARTS} short messages. Put a line containing only --- between messages. ` +
      `Keep each message under about 300 characters, two or three short sentences. Never send a wall of text, ` +
      `even for briefings: pick the few things that matter most instead of covering everything.\n` +
      `- Plain text only. No markdown, no bullet lists, no headers. Never use em dashes or semicolons, ` +
      `use commas and full stops instead. At most one emoji per message, often none.\n` +
      `- When you point at a bookmark or a feed pick, do it like you're handing it to them: a short lead-in like ` +
      `"This is the one:", then the url on its own line, then "The gist:" and one or two sentences. ` +
      `One item per message, at most two or three items in a whole reply.\n` +
      `- Every item is labeled with its medium: articles are read, videos are watched, podcasts are ` +
      `listened to. Use the matching verb and time label, a video is "a 12 min watch", never "a read". ` +
      `When an item has no minutes listed, don't guess a number.\n` +
      `- Encourage them, gently. If an unfinished save fits the conversation, point at one worth picking ` +
      `up, say why in a few words, and mention how long it takes to read, watch or listen. If they have ` +
      `been finishing things, notice it and celebrate briefly. Never guilt trip, never lecture.\n` +
      `- When suggesting what to pick up next, start with their own saves: an unfinished item from ` +
      `THEIR LIBRARY that fits. Reach for THEIR FEED only when nothing saved fits, or when they ask for ` +
      `something new. Always say where a pick comes from, "one of your saves" or "a fresh pick from ` +
      `your feed".\n` +
      `- If they ask for something without saying what kind ("give me something", "what should I check ` +
      `out"), offer one fitting unfinished save and ask what they're in the mood for, like a save or a ` +
      `fresh pick, or a quick read versus a video or podcast. One short question, not an interrogation.\n` +
      `- Where it feels natural, end your last message with one genuinely useful follow-up question, ` +
      `like offering the gist of a pick, asking which one to queue up, or offering to find more like ` +
      `something. Skip it when the conversation is clearly wrapping up. Never ask filler questions.\n` +
      `- If you are not sure what they want, ask, and offer one concrete example of something you can do, ` +
      `like "what did I save about design last month?"\n\n` +
      `What you may talk about:\n` +
      `- Only items that appear below in their library, their feed, or the recently sent list. If they ask ` +
      `about something that is not there, say you couldn't sniff that one out and ask them to send you the ` +
      `link. Never invent titles, contents or urls.\n` +
      `- Feed picks are recommendations they have NOT saved yet. You cannot save things yourself. If they ` +
      `want a feed item saved or properly summarized, hand them its url on its own line and tell them: ` +
      `send that link back to me and I'll save it and read it for you.\n\n` +
      `Today is ${new Date().toISOString().slice(0, 10)}. ` +
      `They have finished ${readCount} of their ${items.length} processed saves.\n\n` +
      `THEIR PREFERENCES:\n` +
      `- Interests they picked: ${preferredTopics.join(", ") || "none picked yet"}\n` +
      `- Topics they chose to hide: ${mutedTopics.join(", ") || "none"}\n` +
      `Lean toward their interests when suggesting what to pick up or building a briefing. ` +
      `Never surface a hidden topic unless they ask for it by name.\n\n` +
      `THEIR LIBRARY (things they saved, most relevant to this message first, then newest):\n${context || "nothing saved yet"}\n\n` +
      `THEIR FEED (recommended for them, NOT saved yet):\n${feedContext || "nothing right now"}\n\n` +
      `LINKS YOU (RUDOLF) SENT THEM RECENTLY:\n${mentionsContext || "none"}`,
    messages: [{ role: "user", content: question }],
  });

  const answer = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!answer) {
    await channel.sendMessages([
      "Hmm, I lost my train of thought there. Mind asking that again?",
    ]);
    return;
  }
  const parts = answer.split(/\n\s*-{3,}\s*\n/);
  await channel.sendMessages(parts);

  // Remember which links Rudolf handed over, so "save that one you sent me"
  // still resolves after the feed snapshot rotates.
  const mentionedUrls = [...new Set(answer.match(URL_RE) ?? [])];
  if (mentionedUrls.length) {
    const titleFor = (url: string) =>
      feed.find((e) => e.url === url)?.title ??
      items.find((i) => i.url === url)?.title ??
      url;
    await rememberMentions(
      channel.memoryKey,
      mentionedUrls.map((url) => ({ url, title: titleFor(url) })),
    );
  }
}
