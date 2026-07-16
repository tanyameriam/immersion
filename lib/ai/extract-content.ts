import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { spotifyEpisodeId } from "@/lib/ai/media-content";
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
  /** Set when the URL is recognizably a video or podcast, so the saved item's
   * `type` (and the dashboard's Medium filter) can reflect it. */
  medium?: "article" | "video" | "podcast";
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

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
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
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  const html = await fetchHtml(url).catch(() => "");
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

  // ── YouTube: use oEmbed for a real title + thumbnail. ──
  if (isYouTube(url)) {
    const yt = await youTubeOEmbed(url);
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
    const { wordCount, readingTime } = readingTimeOf(text);
    return {
      title,
      description,
      image: yt?.thumbnail || image,
      text,
      wordCount,
      readingTime,
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
  return {
    title: title || url,
    description,
    image,
    text,
    wordCount,
    readingTime,
    degraded,
  };
}
