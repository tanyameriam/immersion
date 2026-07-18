import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  fetchYouTubeDescription,
  spotifyEpisodeId,
  youTubeVideoId,
} from "@/lib/ai/media-content";
import { fetchSpotifyEpisode } from "@/lib/recommendations/sources/spotify";

const MAX_CHARS = 14_000; // token/cost guard before sending to Claude
const WORDS_PER_MIN = 225;
const FETCH_TIMEOUT_MS = 8_000;
// A realistic browser UA - many sites serve a bot/empty shell to non-browser
// agents, which wrecks extraction.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ExtractedContent {
  title: string;
  description: string;
  image: string;
  text: string;
  wordCount: number;
  readingTime: number; // minutes
  /** True when readable article extraction failed and we used meta fallbacks. */
  degraded: boolean;
  /** True when the site served a bot challenge (Cloudflare "Just a moment…"
   * etc.) instead of the page. There is nothing honest to summarize: callers
   * should skip AI analysis and keep whatever title the save already carried. */
  blocked?: boolean;
  /** Set when the URL is recognizably a video or podcast, so the saved item's
   * `type` (and the dashboard's Medium filter) can reflect it. */
  medium?: "article" | "video" | "podcast";
}

/** Page content captured in the saver's own browser (extension). It has
 * passed bot checks, logins, and JS rendering, so when present and
 * substantial it beats anything we can fetch server-side. */
export interface ClientCapture {
  title?: string;
  text?: string;
  description?: string;
  image?: string;
}

function metaTag(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const content = el?.getAttribute("content") ?? el?.textContent ?? "";
    if (content && content.trim()) return content.trim();
  }
  return "";
}

/** Returns true if this is a YouTube watch/short URL. */
function isYouTube(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return true;
    if (host.endsWith("youtube.com") && (u.searchParams.get("v") || u.pathname.startsWith("/shorts/")))
      return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch YouTube's oEmbed data - gives the real video title, author, and
 * thumbnail without needing to render JavaScript.
 */
async function youTubeOEmbed(
  url: string,
): Promise<{ title: string; author: string; thumbnail: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title ?? "",
      author: data.author_name ?? "",
      thumbnail: data.thumbnail_url ?? "",
    };
  } catch {
    return null;
  }
}

/** Video platforms beyond YouTube whose pages carry no readable article text.
 * We can't get their runtime without per-site APIs, so saves from these hosts
 * are typed "video" with no time estimate rather than a fake "read". */
const VIDEO_HOSTS = [
  "vimeo.com",
  "tiktok.com",
  "loom.com",
  "twitch.tv",
  "dailymotion.com",
];

function isVideoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function isSpotify(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "spotify.com" || host.endsWith(".spotify.com");
  } catch {
    return false;
  }
}

function isLinkedIn(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

/**
 * Spotify's public oEmbed endpoint - title and cover art for any Spotify URL
 * (episode, show, track, album, playlist) without API keys.
 */
async function spotifyOEmbed(
  url: string,
): Promise<{ title: string; thumbnail: string } | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return { title: data.title ?? "", thumbnail: data.thumbnail_url ?? "" };
  } catch {
    return null;
  }
}

/** A readable title derived from a LinkedIn URL when the authwall blocks
 * everything else, e.g. /posts/jane-doe_design-systems-... → "jane doe". */
function linkedInFallbackTitle(url: string): string {
  try {
    const path = new URL(url).pathname;
    const post = path.match(/^\/posts\/([^_/]+)/);
    if (post) return `LinkedIn post by ${post[1].replace(/-/g, " ")}`;
    const profile = path.match(/^\/in\/([^/]+)/);
    if (profile) return `LinkedIn profile: ${profile[1].replace(/-/g, " ")}`;
    const pulse = path.match(/^\/pulse\/([^/]+)/);
    if (pulse) return pulse[1].replace(/-/g, " ");
    return "LinkedIn post";
  } catch {
    return "LinkedIn post";
  }
}

async function fetchHtml(
  url: string,
): Promise<{ html: string; challenged: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    // Cloudflare's documented signal that it served a challenge, not the page.
    const challenged = res.headers.get("cf-mitigated") === "challenge";
    return { html: await res.text(), challenged };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bot-challenge interstitials (Cloudflare and friends) have a title and a bit
 * of text, so without this check they'd flow through the degraded-meta path
 * and we'd store "Just a moment…" as the article and pay to summarize it.
 */
function looksLikeBotChallenge(title: string, html: string): boolean {
  const t = title.trim().toLowerCase();
  if (
    /^just a moment/.test(t) ||
    t.includes("attention required") ||
    t.startsWith("access denied") ||
    t.includes("verify you are human") ||
    t.includes("verifying you are human") ||
    t.includes("checking your browser") ||
    t.includes("are you a robot")
  ) {
    return true;
  }
  // Markers that only appear in Cloudflare challenge pages, never in articles.
  return /cf_chl_|cf-browser-verification|challenge-error-text/.test(html);
}

function readingTimeOf(text: string): { wordCount: number; readingTime: number } {
  const wordCount = text ? text.split(/\s+/).length : 0;
  return { wordCount, readingTime: Math.max(1, Math.round(wordCount / WORDS_PER_MIN)) };
}

/**
 * Fetch a URL and extract readable content. Never throws for content reasons -
 * degrades to meta tags on JS-heavy / paywalled pages. Handles YouTube videos
 * specially via oEmbed so they get their real title, thumbnail, and a
 * description-based summary instead of a generic "YouTube" blurb.
 *
 * When `client` carries substantial text captured in the saver's browser, it
 * is used directly and no server-side fetch happens: the browser has already
 * passed bot checks, paywalls, and JS rendering that a datacenter fetch can't.
 */
export async function extractContent(
  url: string,
  client?: ClientCapture,
): Promise<ExtractedContent> {
  // ── Client capture: trust the saver's own browser over our fetch. YouTube
  // and Spotify still go through oEmbed, where page text is chrome, not content. ──
  const clientText = client?.text?.replace(/\s+/g, " ").trim() ?? "";
  if (clientText.length > 400 && !isYouTube(url) && !isSpotify(url)) {
    const video = isVideoHost(url);
    const text = clientText.slice(0, MAX_CHARS);
    const { wordCount, readingTime } = readingTimeOf(text);
    return {
      title: client?.title?.trim() ?? "",
      description: client?.description?.trim().slice(0, 500) ?? "",
      image: client?.image ?? "",
      text,
      wordCount,
      // Page text on a video host is chrome and comments, not the video, so
      // its word count says nothing about how long the video runs.
      readingTime: video ? 0 : readingTime,
      degraded: false,
      ...(video ? { medium: "video" as const } : {}),
    };
  }

  const { html, challenged } = await fetchHtml(url).catch(() => ({
    html: "",
    challenged: false,
  }));
  const { document } = parseHTML(html || "<html></html>");

  const metaTitle =
    metaTag(document, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    document.querySelector("title")?.textContent?.trim() ||
    "";
  const description = metaTag(document, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);
  const image = metaTag(document, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);

  // ── YouTube: use oEmbed for a real title + thumbnail, and the Data API
  // (when YOUTUBE_API_KEY is set) for the real runtime, so the saved item can
  // say "12 min watch" instead of a reading time of its description text. ──
  if (isYouTube(url)) {
    const videoId = youTubeVideoId(url);
    const [yt, detail] = await Promise.all([
      youTubeOEmbed(url),
      videoId ? fetchYouTubeDescription(videoId) : Promise.resolve(null),
    ]);
    const title = yt?.title || metaTitle || url;
    // oEmbed failing for a YouTube URL usually means the video is private,
    // members-only, or removed - say so instead of leaving a blank summary.
    const text = (
      yt
        ? [
            `Video title: ${title}`,
            yt.author ? `Channel: ${yt.author}` : "",
            description ? `Description: ${description}` : "",
          ]
        : [
            `Video title: ${title}`,
            "This YouTube video could not be read. It may be private, members only, or removed.",
            description ? `Description: ${description}` : "",
          ]
    )
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_CHARS);
    const { wordCount } = readingTimeOf(text);
    return {
      title,
      description,
      image: yt?.thumbnail || image,
      text,
      wordCount,
      // The real runtime, or 0 when unavailable: a description-word-count
      // "reading time" is meaningless for a video, so displays should omit
      // the minutes rather than show a wrong number.
      readingTime: detail?.durationMinutes ?? 0,
      degraded: !yt, // degraded only if oEmbed failed
      medium: "video",
    };
  }

  // ── Spotify: episodes get real metadata via the Web API when keys exist;
  // everything Spotify falls back to keyless oEmbed (title + cover art). ──
  if (isSpotify(url)) {
    const episodeId = spotifyEpisodeId(url);
    if (episodeId) {
      const ep = await fetchSpotifyEpisode(episodeId);
      if (ep?.name) {
        const text = [
          `Podcast episode: ${ep.name}`,
          ep.description ? `Description: ${ep.description}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, MAX_CHARS);
        const { wordCount } = readingTimeOf(text);
        return {
          title: ep.name,
          description: ep.description.slice(0, 500),
          image: ep.image || image,
          text,
          wordCount,
          readingTime: Math.max(1, Math.round(ep.durationMs / 60_000)),
          // The description is not the audio itself, so summaries stay honest.
          degraded: true,
          medium: "podcast",
        };
      }
    }
    const oe = await spotifyOEmbed(url);
    const title = oe?.title || metaTitle || url;
    const text = [
      `Spotify: ${title}`,
      description ? `Description: ${description}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_CHARS);
    const { wordCount, readingTime } = readingTimeOf(text);
    const isPodcast = /\/(episode|show)\//.test(url);
    return {
      title,
      description,
      image: oe?.thumbnail || image,
      text,
      wordCount,
      readingTime,
      degraded: true,
      ...(isPodcast ? { medium: "podcast" as const } : {}),
    };
  }

  // ── LinkedIn: anonymous fetches hit an authwall; use OG tags when present,
  // else derive a readable title from the URL. Always honest about it. ──
  if (isLinkedIn(url)) {
    const title = metaTitle || linkedInFallbackTitle(url);
    const text = [
      `LinkedIn: ${title}`,
      description ? `Description: ${description}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_CHARS);
    const { wordCount, readingTime } = readingTimeOf(text);
    return {
      title,
      description,
      image,
      text,
      wordCount,
      readingTime,
      degraded: true,
    };
  }

  // ── Bot challenge: the "page" is Cloudflare's interstitial, not content.
  // Return empty fields (blocked) so the caller keeps the save's own title
  // and skips AI analysis instead of summarizing a loading screen. ──
  if (challenged || looksLikeBotChallenge(metaTitle, html)) {
    return {
      title: "",
      description: "",
      image: "",
      text: "",
      wordCount: 0,
      readingTime: 0,
      degraded: true,
      blocked: true,
    };
  }

  // ── Articles: Readability, with meta fallback. ──
  let text = "";
  let title = metaTitle;
  let degraded = true;
  try {
    const { document: clone } = parseHTML(html || "<html></html>");
    const article = new Readability(clone as unknown as Document).parse();
    if (article?.textContent && article.textContent.trim().length > 400) {
      text = article.textContent.replace(/\s+/g, " ").trim();
      title = article.title?.trim() || metaTitle;
      degraded = false;
    }
  } catch {
    // fall through to degraded meta-only path
  }

  if (!text) {
    text = [metaTitle, description].filter(Boolean).join(". ").trim();
  }
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  const { wordCount, readingTime } = readingTimeOf(text);
  const video = isVideoHost(url);
  return {
    title: title || url,
    description,
    image,
    text,
    wordCount,
    readingTime: video ? 0 : readingTime,
    degraded,
    ...(video ? { medium: "video" as const } : {}),
  };
}
