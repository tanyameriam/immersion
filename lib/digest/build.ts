import { adminDb } from "@/lib/firebase/admin";
import { toKnowledgeItem } from "@/lib/firestore/items";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";

export interface UserDigest {
  userId: string;
  email: string;
  name: string;
  telegramChatId: string | null;
  items: KnowledgeItem[];
  topTopics: string[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Build a weekly digest for every user who has completed items in the window.
 * Query is index-free (single equality on userId); status/recency filtering and
 * sorting happen in memory so no composite index setup is required.
 */
export async function buildWeeklyDigests(sinceMs = WEEK_MS): Promise<UserDigest[]> {
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();
  const usersSnap = await adminDb().collection("users").get();
  const digests: UserDigest[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const profile = userDoc.data();

    const itemsSnap = await adminDb()
      .collection("knowledgeItems")
      .where("userId", "==", uid)
      .get();

    // ISO timestamps sort lexicographically = chronologically.
    const items = itemsSnap.docs
      .map((d) => toKnowledgeItem(d.id, d.data()))
      .filter((i) => i.status === "completed" && i.createdAt >= sinceIso)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    if (items.length === 0) continue;

    // Rank topics by frequency across the week's items.
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const topic of item.ai?.topics ?? []) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
    }
    const topTopics = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    digests.push({
      userId: uid,
      email: profile.email ?? "",
      name: profile.name ?? "",
      telegramChatId: profile.telegramChatId ?? null,
      items,
      topTopics,
    });
  }

  return digests;
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.layrrrd.com";

/** Plain-text digest (Telegram). */
export function digestText(d: UserDigest): string {
  const name = d.name?.split(" ")[0] || "there";
  const lines = [
    `<b>Your Layrrrd week, ${name}</b>`,
    `${d.items.length} saved · Topics: ${d.topTopics.join(", ") || "—"}`,
    "",
  ];
  for (const item of d.items.slice(0, 8)) {
    lines.push(`• <a href="${item.url}">${item.title}</a>`);
    if (item.ai?.tldr) lines.push(`  ${item.ai.tldr}`);
  }
  lines.push("", `Open your dashboard: ${appUrl}/dashboard`);
  return lines.join("\n");
}

/** HTML digest (email). */
export function digestHtml(d: UserDigest): string {
  const name = d.name?.split(" ")[0] || "there";
  const rows = d.items
    .slice(0, 12)
    .map(
      (item) => `
        <tr><td style="padding:16px 0;border-bottom:1px solid #d9d5cb;">
          <a href="${item.url}" style="color:#1a1a1a;font-weight:700;text-decoration:none;font-size:16px;">${item.title}</a>
          <div style="color:#6b6b6b;font-size:14px;margin-top:4px;">${item.ai?.tldr ?? ""}</div>
          <div style="color:#9a9a9a;font-size:12px;margin-top:6px;">${item.domain} · ${item.ai?.readingTime ?? 0} min read</div>
        </td></tr>`,
    )
    .join("");

  return `
  <div style="background:#f4f1ea;padding:32px 0;font-family:Inter,system-ui,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;">
      <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0;">Layrrrd.</p>
      <h1 style="font-size:24px;margin:16px 0 4px;">Your week, ${name}.</h1>
      <p style="color:#6b6b6b;margin:0 0 8px;">${d.items.length} saved this week · ${d.topTopics.join(", ") || "—"}</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:24px;background:#1a1a1a;color:#f4f1ea;padding:12px 20px;text-decoration:none;font-weight:600;">Open your dashboard</a>
    </div>
  </div>`;
}
