/**
 * Content extraction for media URLs whose pages carry no readable article
 * text: YouTube caption transcripts and Spotify episode descriptions. Used by
 * the on-demand web-summary path so video and podcast picks get summaries of
 * the actual content, not of a thin landing page.
 *
 * Note on sourcing: YouTube captions come from the public timedtext payload
 * referenced by the watch page itself (no key, no login). It is not an
 * official API surface, so this is written to fail soft: any change upstream
 * degrades to the video description rather than breaking summaries.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_TRANSCRIPT_CHARS = 14_000;
/** One timestamp marker roughly every this many seconds of speech. */
const MARKER_INTERVAL_S = 30;

export function youTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const short = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      if (short) return short[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function spotifyEpisodeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("spotify.com")) return null;
    const m = u.pathname.match(/\/episode\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string; // "asr" = auto-generated
};

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const usable = tracks.filter((t) => t.baseUrl);
  return (
    usable.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
    usable.find((t) => t.languageCode?.startsWith("en")) ??
    usable.find((t) => t.kind !== "asr") ??
    usable[0] ??
    null
  );
}

function stamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `[${h}:${mm}:${ss}]` : `[${mm}:${ss}]`;
}

/**
 * The spoken transcript of a YouTube video with [mm:ss] markers sprinkled in,
 * or null when the video has no captions (or the payload shape changed).
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<string | null> {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie: "CONSENT=YES+1",
      },
    });
    if (!page.ok) return null;
    const html = await page.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (!m) return null;
    const track = pickTrack(JSON.parse(m[1]) as CaptionTrack[]);
    if (!track?.baseUrl) return null;

    const res = await fetch(`${track.baseUrl}&fmt=json3`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: { tStartMs?: number; segs?: { utf8?: string }[] }[];
    };

    let out = "";
    let lastMarkerMs = -MARKER_INTERVAL_S * 1000;
    for (const event of data.events ?? []) {
      const text = (event.segs ?? [])
        .map((s) => s.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const at = event.tStartMs ?? 0;
      if (at - lastMarkerMs >= MARKER_INTERVAL_S * 1000) {
        out += `\n${stamp(at)} `;
        lastMarkerMs = at;
      }
      out += `${text} `;
      if (out.length > MAX_TRANSCRIPT_CHARS) break;
    }
    const transcript = out.trim().slice(0, MAX_TRANSCRIPT_CHARS);
    return transcript.length > 200 ? transcript : null;
  } catch (err) {
    console.error(`YouTube transcript failed for ${videoId}`, err);
    return null;
  }
}

/**
 * Fallback when captions are unavailable: the video's full description via
 * the official Data API (needs YOUTUBE_API_KEY). Long-form videos usually
 * carry substantial descriptions, often including a chapter list.
 */
export async function fetchYouTubeDescription(
  videoId: string,
): Promise<{ description: string; durationMinutes: number } | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.search = new URLSearchParams({
      part: "snippet,contentDetails",
      id: videoId,
      key,
    }).toString();
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: {
        snippet?: { description?: string };
        contentDetails?: { duration?: string };
      }[];
    };
    const item = data.items?.[0];
    if (!item?.snippet?.description) return null;
    const d = item.contentDetails?.duration?.match(
      /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
    );
    const durationMinutes = d
      ? Math.max(1, Math.round(Number(d[1] ?? 0) * 60 + Number(d[2] ?? 0) + Number(d[3] ?? 0) / 60))
      : 0;
    return { description: item.snippet.description, durationMinutes };
  } catch (err) {
    console.error(`YouTube description lookup failed for ${videoId}`, err);
    return null;
  }
}
