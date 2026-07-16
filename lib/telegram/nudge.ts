import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCachedFeed, type FeedEntry } from "@/lib/rudolf/feed";
import { getRecentMentions, rememberMentions } from "@/lib/rudolf/memory";
import { sendMessages } from "@/lib/telegram/chat";

/**
 * Proactive Rudolf: a couple of fresh feed picks between digests, over the
 * same daily cron the digest rides. Deterministic schedule, no counters:
 * nudges go out 3 and 5 days after the user's digest day, which guarantees
 * at most 2 per week, never on the digest day, and a 2-day minimum gap.
 * Users can pause with /mute (or the profile toggle); `lastNudgeAt` makes
 * re-runs of the cron idempotent for the day.
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const NUDGE_OFFSETS = [3, 5];
/** Safety valve so a big user base can't blow the cron's time budget. */
const MAX_NUDGES_PER_RUN = 25;
const PICKS_PER_NUDGE = 2;

function isNudgeDay(notificationDay: string, today: string): boolean {
  const digestIdx = WEEKDAYS.indexOf(notificationDay);
  const todayIdx = WEEKDAYS.indexOf(today);
  if (digestIdx === -1 || todayIdx === -1) return false;
  return NUDGE_OFFSETS.some((o) => (digestIdx + o) % 7 === todayIdx);
}

function pickForNudge(feed: FeedEntry[], skip: Set<string>): FeedEntry[] {
  const fresh = feed.filter((e) => !skip.has(e.url));
  // Variety: lead with something from around the web, back it with a
  // community match when there is one.
  const web = fresh.find((e) => e.kind === "web");
  const match = fresh.find((e) => e.kind !== "web" && e.url !== web?.url);
  const picks = [web, match].filter((e): e is FeedEntry => Boolean(e));
  for (const e of fresh) {
    if (picks.length >= PICKS_PER_NUDGE) break;
    if (!picks.includes(e)) picks.push(e);
  }
  return picks.slice(0, PICKS_PER_NUDGE);
}

function nudgeMessages(picks: FeedEntry[]): string[] {
  const parts = ["Woof, went fetching and found something for you 🐕"];
  for (const p of picks) {
    const mins = p.readingTime ? `, ${p.readingTime} min` : "";
    parts.push(
      `${p.title} (${p.source}${mins})\n${p.url}\nWhy you: ${p.reason}`,
    );
  }
  parts.push(
    "Want one in your library? Just send that link back to me. Or ask me anything about it.",
  );
  return parts;
}

export async function sendDueNudges(
  today: string,
  { force = false }: { force?: boolean } = {},
): Promise<{ considered: number; sent: number }> {
  const snap = await adminDb().collection("users").get();
  const todayDate = new Date().toISOString().slice(0, 10);

  let considered = 0;
  let sent = 0;
  for (const doc of snap.docs) {
    if (sent >= MAX_NUDGES_PER_RUN) break;
    const user = doc.data();
    const chatId: string = user.telegramChatId ?? "";
    if (!chatId) continue;
    if (user.botNudges === "off") continue;
    // A paused digest means full quiet: no between-digest picks either.
    if (user.notificationFrequency === "off") continue;
    const notificationDay: string = user.notificationDay ?? "Monday";
    if (!force && !isNudgeDay(notificationDay, today)) continue;
    // Idempotence: a cron re-run (or manual trigger) the same day won't
    // double-message anyone.
    const lastNudgeAt: string = user.lastNudgeAt ?? "";
    if (lastNudgeAt.slice(0, 10) === todayDate) continue;
    considered++;

    try {
      const [feed, mentions] = await Promise.all([
        getCachedFeed(doc.id),
        getRecentMentions(chatId),
      ]);
      const skip = new Set<string>([
        ...(user.dismissedUrls ?? []),
        ...mentions.map((m) => m.url),
      ]);
      const picks = pickForNudge(feed, skip);
      if (!picks.length) continue; // nothing fresh to say — stay quiet

      await sendMessages(Number(chatId), nudgeMessages(picks));
      sent++;

      await doc.ref.update({
        lastNudgeAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await rememberMentions(chatId, picks);
      await adminDb().collection("botNudges").add({
        userId: doc.id,
        sentAt: FieldValue.serverTimestamp(),
        urls: picks.map((p) => p.url),
      });
    } catch (err) {
      console.error("nudge failed for", doc.id, err);
    }
  }
  return { considered, sent };
}
