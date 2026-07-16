import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Short-term per-chat memory: the last links Rudolf himself sent (in answers,
 * nudges, or digests). The bot is otherwise stateless, so this is what lets
 * "save that one you sent me this morning" resolve even after the item has
 * rotated out of the live feed snapshot.
 *
 * Keyed per conversation: Telegram uses the numeric chat id, WhatsApp uses
 * "wa:<waId>". The collection keeps its original name so Telegram memories
 * written before WhatsApp existed survive; it now holds both channels.
 */

const COLLECTION = "telegramChats";
const MAX_MENTIONS = 10;

export type Mention = {
  url: string;
  title: string;
  /** ISO date-time when Rudolf sent it. */
  at: string;
};

export async function rememberMentions(
  chatId: number | string,
  mentions: { url: string; title: string }[],
): Promise<void> {
  if (!mentions.length) return;
  const ref = adminDb().collection(COLLECTION).doc(String(chatId));
  try {
    const snap = await ref.get();
    const existing: Mention[] = snap.data()?.mentions ?? [];
    const now = new Date().toISOString();
    const fresh = mentions.map((m) => ({ ...m, at: now }));
    const seen = new Set(fresh.map((m) => m.url));
    const merged = [
      ...fresh,
      ...existing.filter((m) => !seen.has(m.url)),
    ].slice(0, MAX_MENTIONS);
    await ref.set({ mentions: merged, updatedAt: Timestamp.now() });
  } catch (err) {
    console.error("rememberMentions failed", chatId, err);
  }
}

export async function getRecentMentions(
  chatId: number | string,
): Promise<Mention[]> {
  try {
    const snap = await adminDb()
      .collection(COLLECTION)
      .doc(String(chatId))
      .get();
    return (snap.data()?.mentions ?? []) as Mention[];
  } catch (err) {
    console.error("getRecentMentions failed", chatId, err);
    return [];
  }
}
