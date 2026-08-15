import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import { durationLabel } from "@/lib/medium-label";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.layrrrd.com";

export interface UserDigest {
  userId: string;
  email: string;
  name: string;
  telegramChatId: string | null;
  notificationDay: string;
  notificationPreference: string;
  /** "weekly" | "biweekly" | "off"; docs without the field mean weekly. */
  notificationFrequency: string;
  /** ISO timestamp of the last digest actually delivered; "" if never. */
  lastDigestSentAt: string;
  /** Billing plan ("free" | "pro") - the cron route gates delivery on it. */
  plan: string;
  byTopic: [string, KnowledgeItem[]][]; // top topics → items saved this week
  unread: KnowledgeItem[]; // completed but not read
  /** Fresh external-source picks, each carrying its `reason`. Attached by
   * the cron route only for users actually getting a digest today. */
  recommendations?: Resource[];
  savedThisWeek: number;
  readThisWeek: number;
  communityAvgRead: number;
}

function readThisWeekCount(items: KnowledgeItem[], sinceIso: string): number {
  return items.filter((i) => i.read && (i.readAt ?? "") >= sinceIso).length;
}

/**
 * Build a weekly digest for every user with activity. Groups this week's saves
 * by topic, lists what's still unread, and computes how many articles the user
 * read this week vs the community average (for encouragement). Index-free.
 */
export async function buildWeeklyDigests(sinceMs = WEEK_MS): Promise<UserDigest[]> {
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();

  const usersSnap = await adminDb().collection("users").get();
  const profiles = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));

  const allSnap = await adminDb()
    .collection("knowledgeItems")
    .where("status", "==", "completed")
    .get();

  // Group completed items by user.
  const byUser = new Map<string, KnowledgeItem[]>();
  for (const doc of allSnap.docs) {
    const item = toKnowledgeItem(doc.id, doc.data());
    const list = byUser.get(item.userId) ?? [];
    list.push(item);
    byUser.set(item.userId, list);
  }

  // Email addresses live in Firebase Auth (sign-in), not on the profile doc —
  // look them up so the digest always has somewhere to deliver.
  const authEmails = new Map<string, string>();
  const uids = [...byUser.keys()];
  for (let i = 0; i < uids.length; i += 100) {
    const res = await adminAuth().getUsers(
      uids.slice(i, i + 100).map((uid) => ({ uid })),
    );
    for (const u of res.users) if (u.email) authEmails.set(u.uid, u.email);
  }

  // Community average of articles read this week.
  let totalReads = 0;
  let activeUsers = 0;
  for (const items of byUser.values()) {
    totalReads += readThisWeekCount(items, sinceIso);
    activeUsers++;
  }
  const communityAvgRead = activeUsers ? totalReads / activeUsers : 0;

  const digests: UserDigest[] = [];
  const norm = (t: string) => t.toLowerCase().trim();
  for (const [uid, items] of byUser.entries()) {
    const profile = profiles.get(uid);
    if (!profile) continue;

    // The user's preference set shapes what the digest features: stated
    // interests float to the top, hidden topics stay out entirely.
    const preferred = new Set<string>(
      (profile.preferredTopics ?? []).map(norm),
    );
    const muted = new Set<string>((profile.mutedTopics ?? []).map(norm));
    const matchesPreference = (i: KnowledgeItem) =>
      (i.ai?.topics ?? []).some((t) => preferred.has(norm(t)));
    const allMuted = (i: KnowledgeItem) => {
      const topics = i.ai?.topics ?? [];
      return topics.length > 0 && topics.every((t) => muted.has(norm(t)));
    };

    const weekItems = items
      .filter((i) => i.createdAt >= sinceIso)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const unread = items
      .filter((i) => !i.read && !allMuted(i))
      .sort((a, b) => {
        const ap = matchesPreference(a) ? 1 : 0;
        const bp = matchesPreference(b) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return a.createdAt < b.createdAt ? 1 : -1;
      })
      .slice(0, 5);

    if (weekItems.length === 0 && unread.length === 0) continue;

    // Group this week's saves by topic (hidden topics excluded).
    const topicMap = new Map<string, KnowledgeItem[]>();
    for (const item of weekItems) {
      for (const topic of item.ai?.topics ?? []) {
        if (muted.has(norm(topic))) continue;
        const list = topicMap.get(topic) ?? [];
        if (list.length < 3) list.push(item);
        topicMap.set(topic, list);
      }
    }
    const byTopic = [...topicMap.entries()]
      .sort((a, b) => {
        const ap = preferred.has(norm(a[0])) ? 1 : 0;
        const bp = preferred.has(norm(b[0])) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return b[1].length - a[1].length;
      })
      .slice(0, 3);

    digests.push({
      userId: uid,
      email: profile.email || authEmails.get(uid) || "",
      name: profile.name ?? "",
      telegramChatId: profile.telegramChatId ?? null,
      notificationDay: profile.notificationDay ?? "Monday",
      notificationPreference: profile.notificationPreference ?? "email",
      notificationFrequency: profile.notificationFrequency ?? "weekly",
      lastDigestSentAt: profile.lastDigestSentAt ?? "",
      plan: profile.plan === "pro" ? "pro" : "free",
      byTopic,
      unread,
      savedThisWeek: weekItems.length,
      readThisWeek: readThisWeekCount(items, sinceIso),
      communityAvgRead,
    });
  }

  return digests;
}

/** Escape text interpolated into digest markup (Telegram parse_mode=HTML and
 * the email template): names, titles and reasons come from users and external
 * pages, and a stray `<` or `&` would otherwise break the whole message. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function peerLine(d: UserDigest): string {
  const avg = Math.round(d.communityAvgRead * 10) / 10;
  const diff = Math.round((d.readThisWeek - d.communityAvgRead) * 10) / 10;
  if (d.readThisWeek > d.communityAvgRead && diff >= 1) {
    return `You finished ${d.readThisWeek} saves this week, ${diff} more than the community average (${avg}). Keep upskilling! 🎉`;
  }
  if (d.readThisWeek > 0) {
    return `You finished ${d.readThisWeek} save${d.readThisWeek === 1 ? "" : "s"} this week. The community averages ${avg}.`;
  }
  return `You haven't marked anything finished yet. Your shelf is waiting below.`;
}

function minutesLabel(it: KnowledgeItem): string {
  const label = durationLabel(it.type, it.ai?.readingTime);
  return label ? ` · ${label}` : "";
}

function totalUnreadMinutes(d: UserDigest): number {
  return d.unread.reduce((sum, it) => sum + (it.ai?.readingTime ?? 0), 0);
}

/** Short opt-in message sent before the digest content itself - nothing is
 * delivered until the user replies (see lib/rudolf/chat.ts's consent
 * handling). Keeps Rudolf from pushing content unprompted. */
export function digestConsentPrompt(d: UserDigest): string {
  const name = esc(d.name?.split(" ")[0] || "there");
  return (
    `Woof, your Layrrrd week is ready, ${name} 🐕 Want it now? ` +
    `Reply yes and I'll send it over in a few short messages. ` +
    `Reply no and I'll check back next week.`
  );
}

/** Plain-text digest (Telegram), as separate short messages instead of one
 * long one: an intro, a picks section, one message per topic, and a shelf
 * reminder, each easy to skim on its own. */
export function digestParts(d: UserDigest): string[] {
  const name = esc(d.name?.split(" ")[0] || "there");
  const parts: string[] = [`<b>Your Layrrrd week, ${name}</b>\n${peerLine(d)}`];

  const picks = (d.recommendations ?? []).slice(0, 3);
  if (picks.length) {
    const lines = [`<b>Picked for you</b>`];
    for (const r of picks) {
      const label = durationLabel(r.contentType, r.readingTime);
      lines.push(`• <a href="${esc(r.url)}">${esc(r.title)}</a>${label ? ` · ${label}` : ""}`);
      if (r.reason) lines.push(`<i>${esc(r.reason)}</i>`);
    }
    parts.push(lines.join("\n"));
  }

  for (const [topic, items] of d.byTopic) {
    const lines = [`<b>${esc(topic)}</b>`];
    for (const it of items)
      lines.push(`• <a href="${esc(it.url)}">${esc(it.title)}</a>${minutesLabel(it)}`);
    parts.push(lines.join("\n"));
  }

  if (d.unread.length) {
    const total = totalUnreadMinutes(d);
    const lines = [
      `<b>Still on your shelf</b>${total > 0 ? ` · about ${total} min in total, pick what fits` : ""}`,
    ];
    for (const it of d.unread)
      lines.push(`• <a href="${esc(it.url)}">${esc(it.title)}</a>${minutesLabel(it)}`);
    parts.push(lines.join("\n"));
  }

  parts.push(`Open your dashboard: ${appUrl}/dashboard`);
  return parts;
}

/** HTML digest (email). */
export function digestHtml(d: UserDigest): string {
  const name = esc(d.name?.split(" ")[0] || "there");

  const topicBlocks = d.byTopic
    .map(
      ([topic, items]) => `
      <div style="margin-top:24px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">${esc(topic)}</p>
        ${items
          .map(
            (it) => `<div style="padding:10px 0;border-bottom:1px solid #eee;">
              <a href="${esc(it.url)}" style="color:#1a1a1a;font-weight:600;text-decoration:none;">${esc(it.title)}</a>
              <span style="color:#9a9a9a;font-size:12px;">${minutesLabel(it)}</span>
              <div style="color:#6b6b6b;font-size:13px;">${esc(it.ai?.tldr ?? "")}</div>
            </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");

  const recsBlock = d.recommendations?.length
    ? `<div style="margin-top:28px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">Picked for you</p>
        ${d.recommendations
          .slice(0, 3)
          .map((r) => {
            const label = durationLabel(r.contentType, r.readingTime);
            return `<div style="padding:8px 0;border-bottom:1px solid #eee;">
              <a href="${esc(r.url)}" style="color:#1a1a1a;text-decoration:none;">${esc(r.title)}</a>
              ${label ? `<span style="color:#9a9a9a;font-size:12px;"> · ${label}</span>` : ""}
              ${r.reason ? `<div style="color:#6b6b6b;font-size:13px;font-style:italic;">${esc(r.reason)}</div>` : ""}
            </div>`;
          })
          .join("")}
      </div>`
    : "";

  const unreadBlock = d.unread.length
    ? `<div style="margin-top:28px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">Still on your shelf · pick what fits your time</p>
        ${d.unread
          .map(
            (it) => `<div style="padding:8px 0;border-bottom:1px solid #eee;">
              <a href="${esc(it.url)}" style="color:#1a1a1a;text-decoration:none;">${esc(it.title)}</a>
              <span style="color:#9a9a9a;font-size:12px;">${minutesLabel(it)}</span>
            </div>`,
          )
          .join("")}
      </div>`
    : "";

  return `
  <div style="background:#f4f1ea;padding:32px 0;font-family:Inter,system-ui,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;">
      <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0;">Layrrrd.</p>
      <h1 style="font-size:24px;margin:16px 0 6px;">Your week, ${name}.</h1>
      <p style="color:#1a1a1a;font-weight:600;margin:0;">${peerLine(d)}</p>
      <p style="color:#6b6b6b;margin:6px 0 0;font-size:14px;">${d.savedThisWeek} saved this week.</p>
      ${recsBlock}
      ${topicBlocks}
      ${unreadBlock}
      <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:28px;background:#1a1a1a;color:#f4f1ea;padding:12px 20px;text-decoration:none;font-weight:600;">Open your dashboard</a>
    </div>
  </div>`;
}
