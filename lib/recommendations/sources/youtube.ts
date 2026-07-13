import type { Candidate, SourceFetcher } from "./types";
import { FETCH_TIMEOUT_MS } from "./types";

/**
 * YouTube videos via the official Data API v3 (no scraping). Two calls per
 * topic: search (most-viewed uploads from the last 90 days, 100 quota units)
 * then videos (statistics + duration, 1 unit). With topic-level caching in
 * the feed builder this stays around a few hundred units per day against the
 * default 10k daily quota.
 */

const SEARCH_WINDOW_DAYS = 90;

type SearchItem = { id?: { videoId?: string } };
type VideoItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: { viewCount?: string };
  contentDetails?: { duration?: string };
};

/** ISO-8601 duration (PT1H2M3S) → whole minutes, minimum 1. */
function durationToMinutes(iso: string | undefined): number {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const minutes =
    Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
  return Math.max(1, Math.round(minutes));
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YouTube API responded ${res.status}`);
  return res.json();
}

export const youtubeSource: SourceFetcher = {
  id: "youtube",
  medium: "video",
  enabled: () => Boolean(process.env.YOUTUBE_API_KEY),
  async fetchTopic(topic) {
    const key = process.env.YOUTUBE_API_KEY!;
    const publishedAfter = new Date(
      Date.now() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const search = new URL("https://www.googleapis.com/youtube/v3/search");
    search.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      order: "viewCount",
      maxResults: "10",
      publishedAfter,
      relevanceLanguage: "en",
      q: topic.label,
      key,
    }).toString();
    const found = (await getJson(search.toString())) as { items?: SearchItem[] };
    const ids = (found.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return [];

    const videos = new URL("https://www.googleapis.com/youtube/v3/videos");
    videos.search = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: ids.join(","),
      key,
    }).toString();
    const details = (await getJson(videos.toString())) as { items?: VideoItem[] };

    return (details.items ?? []).map((v): Candidate => {
      const views = Number(v.statistics?.viewCount ?? 0);
      const publishedAt = v.snippet?.publishedAt
        ? new Date(v.snippet.publishedAt).getTime()
        : 0;
      const url = `https://www.youtube.com/watch?v=${v.id}`;
      const description = (v.snippet?.description ?? "").split("\n")[0];
      return {
        medium: "video",
        topic: topic.label,
        // Log so a 10M-view outlier doesn't flatten everything else.
        engagement: Math.log10(views + 1),
        publishedAt,
        resource: {
          id: `web-${url}`,
          title: v.snippet?.title ?? url,
          description:
            description.length > 200
              ? `${description.slice(0, 200).trimEnd()}…`
              : description,
          category: [topic.label],
          contentType: "Video",
          medium: "video",
          source: v.snippet?.channelTitle || "YouTube",
          readingTime: durationToMinutes(v.contentDetails?.duration),
          publishedDate: publishedAt
            ? new Date(publishedAt).toISOString()
            : new Date().toISOString(),
          url,
          image:
            v.snippet?.thumbnails?.high?.url ??
            v.snippet?.thumbnails?.medium?.url,
          reason: `Popular on YouTube because you're into ${topic.label}`,
          reasonTopic: topic.label,
          kind: "web" as const,
        },
      };
    });
  },
};
