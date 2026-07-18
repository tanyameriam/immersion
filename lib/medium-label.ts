import { ITEM_MEDIUMS, type ItemMedium } from "@/lib/types/knowledge-item";

/**
 * Medium-aware wording shared by every surface that talks about a saved
 * item's time cost (Rudolf chat, nudges, digest): articles are read, videos
 * are watched, podcasts are listened to.
 */

/** Legacy docs hold free-form type strings; anything unknown reads as article. */
export function toMedium(type: string | undefined): ItemMedium {
  const t = (type ?? "").toLowerCase();
  return (ITEM_MEDIUMS as readonly string[]).includes(t)
    ? (t as ItemMedium)
    : "article";
}

const DURATION_NOUN: Record<ItemMedium, string> = {
  article: "read",
  video: "watch",
  podcast: "listen",
};

/** "7 min read" / "12 min watch" / "35 min listen", or "" without minutes. */
export function durationLabel(
  type: string | undefined,
  mins: number | undefined,
): string {
  if (!mins || mins <= 0) return "";
  return `${mins} min ${DURATION_NOUN[toMedium(type)]}`;
}

/** "a 7 minute read" but "an 8 minute watch": the article follows the spoken
 * number (eight, eleven, eighteen, eighty…). */
function aOrAn(n: number): string {
  return n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89) ? "an" : "a";
}

/** The save-confirmation line about when/how to come back to an item. */
export function savedNudge(
  type: string | undefined,
  mins: number | undefined,
): string {
  const medium = toMedium(type);
  if (mins && mins > 0) {
    return `About ${aOrAn(mins)} ${mins} minute ${DURATION_NOUN[medium]} when you're ready 🙂`;
  }
  if (medium === "video") {
    return "It's a video, saved for whenever you're ready to watch.";
  }
  if (medium === "podcast") {
    return "It's a podcast, saved for whenever you're ready to listen.";
  }
  return "It's in your library whenever you're ready.";
}
