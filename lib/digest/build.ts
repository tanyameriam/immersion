import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.layrrrd.com";

export interface UserDigest {
  userId: string;
  email: string;
  name: string;
  telegramChatId: string | null;
  notificationDay: string;
  notificationPreference: string;
  byTopic: [string, KnowledgeItem[]][]; // top topics → items saved this week
  unread: KnowledgeItem[]; // completed but not read
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

  // Community average of articles read this week.
  let totalReads = 0;
  let activeUsers = 0;
  for (const items of byUser.values()) {
    totalReads += readThisWeekCount(items, sinceIso);
    activeUsers++;
  }
  const communityAvgRead = activeUsers ? totalReads / activeUsers : 0;

  const digests: UserDigest[] = [];
  for (const [uid, items] of byUser.entries()) {
    const profile = profiles.get(uid);
    if (!profile) continue;

    const weekItems = items
      .filter((i) => i.createdAt >= sinceIso)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const unread = items
      .filter((i) => !i.read)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 8);

    if (weekItems.length === 0 && unread.length === 0) continue;

    // Group this week's saves by topic.
    const topicMap = new Map<string, KnowledgeItem[]>();
    for (const item of weekItems) {
      for (const topic of item.ai?.topics ?? []) {
        const list = topicMap.get(topic) ?? [];
        if (list.length < 5) list.push(item);
        topicMap.set(topic, list);
      }
    }
    const byTopic = [...topicMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6);

    digests.push({
      userId: uid,
      email: profile.email ?? "",
      name: profile.name ?? "",
      telegramChatId: profile.telegramChatId ?? null,
      notificationDay: profile.notificationDay ?? "Monday",
      notificationPreference: profile.notificationPreference ?? "email",
      byTopic,
      unread,
      savedThisWeek: weekItems.length,
      readThisWeek: readThisWeekCount(items, sinceIso),
      communityAvgRead,
    });
  }

  return digests;
}

function peerLine(d: UserDigest): string {
  const avg = Math.round(d.communityAvgRead * 10) / 10;
  const diff = Math.round((d.readThisWeek - d.communityAvgRead) * 10) / 10;
  if (d.readThisWeek > d.communityAvgRead && diff >= 1) {
    return `You read ${d.readThisWeek} articles this week, ${diff} more than the average reader (${avg}). Keep upskilling! 🎉`;
  }
  if (d.readThisWeek > 0) {
    return `You read ${d.readThisWeek} article${d.readThisWeek === 1 ? "" : "s"} this week. The community averages ${avg}.`;
  }
  return `You haven't marked anything read yet. Your unread list is waiting below.`;
}

/** Plain-text digest (Telegram). */
export function digestText(d: UserDigest): string {
  const name = d.name?.split(" ")[0] || "there";
  const lines = [`<b>Your Layrrrd week, ${name}</b>`, peerLine(d), ""];

  for (const [topic, items] of d.byTopic) {
    lines.push(`<b>${topic}</b>`);
    for (const it of items) lines.push(`• <a href="${it.url}">${it.title}</a>`);
    lines.push("");
  }

  if (d.unread.length) {
    lines.push("<b>Still to read</b>");
    for (const it of d.unread) lines.push(`• <a href="${it.url}">${it.title}</a>`);
    lines.push("");
  }

  lines.push(`Open your dashboard: ${appUrl}/dashboard`);
  return lines.join("\n");
}

/** HTML digest (email). */
export function digestHtml(d: UserDigest): string {
  const name = d.name?.split(" ")[0] || "there";

  const topicBlocks = d.byTopic
    .map(
      ([topic, items]) => `
      <div style="margin-top:24px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">${topic}</p>
        ${items
          .map(
            (it) => `<div style="padding:10px 0;border-bottom:1px solid #eee;">
              <a href="${it.url}" style="color:#1a1a1a;font-weight:600;text-decoration:none;">${it.title}</a>
              <div style="color:#6b6b6b;font-size:13px;">${it.ai?.tldr ?? ""}</div>
            </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");

  const unreadBlock = d.unread.length
    ? `<div style="margin-top:28px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">Still to read</p>
        ${d.unread
          .map(
            (it) => `<div style="padding:8px 0;border-bottom:1px solid #eee;">
              <a href="${it.url}" style="color:#1a1a1a;text-decoration:none;">${it.title}</a>
              <span style="color:#9a9a9a;font-size:12px;"> · ${it.ai?.readingTime ?? 0} min</span>
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
      ${topicBlocks}
      ${unreadBlock}
      <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:28px;background:#1a1a1a;color:#f4f1ea;padding:12px 20px;text-decoration:none;font-weight:600;">Open your dashboard</a>
    </div>
  </div>`;
}
