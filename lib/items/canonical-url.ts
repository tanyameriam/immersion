import { youTubeVideoId } from "@/lib/ai/media-content";

/**
 * Canonicalize a URL before it becomes a bookmark identity, so share-link
 * variants of the same page (tracking params, www., trailing slash, youtu.be
 * vs watch?v=) dedupe to one saved item across every channel.
 *
 * Deliberately conservative: only parameters that are pure tracking are
 * stripped, hosts are only rewritten for YouTube, and http is never forced to
 * https (some pages really differ).
 */

/** Params that are tracking noise on any site. utm_* is matched by prefix. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

/** Hosts where `si` is a pure share-tracking param (it is meaningful elsewhere). */
const SI_TRACKING_HOSTS = ["youtube.com", "youtu.be", "spotify.com"];

function hostMatches(host: string, suffixes: string[]): boolean {
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

export function canonicalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw; // zod rejects invalid URLs at the API boundary anyway
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return raw;

  // Every YouTube video form collapses to one canonical watch URL.
  const videoId = youTubeVideoId(raw);
  if (videoId && hostMatches(u.hostname.toLowerCase(), ["youtube.com", "youtu.be"])) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  // The URL parser already lowercases hosts and drops default ports.
  u.hostname = u.hostname.replace(/^www\./, "");
  u.hash = "";

  const stripSi = hostMatches(u.hostname, SI_TRACKING_HOSTS);
  const kept: [string, string][] = [];
  for (const [key, value] of u.searchParams.entries()) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_")) continue;
    if (TRACKING_PARAMS.has(k)) continue;
    if (k === "si" && stripSi) continue;
    kept.push([key, value]);
  }
  // Sort so param-order variants of the same URL hash identically.
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [key, value] of kept) u.searchParams.append(key, value);

  // Trailing slash on a non-root path is the same page.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}
