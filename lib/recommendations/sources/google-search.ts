import type { Candidate, SourceFetcher } from "./types";
import { FETCH_TIMEOUT_MS } from "./types";

/**
 * Fresh articles from across the whole web via the official Google Custom
 * Search JSON API (Programmable Search Engine) — the compliant substitute for
 * scraping Google results. The API exposes relevance order, not engagement
 * counts, so the documented heuristic is rank position as `engagement`.
 * Results are restricted to the last 3 months for freshness. Free tier is
 * 100 queries/day; topic-level caching keeps usage to a handful.
 */

type SearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
  pagemap?: {
    cse_image?: { src?: string }[];
    metatags?: Record<string, string | undefined>[];
  };
};

export const googleSearchSource: SourceFetcher = {
  id: "google",
  medium: "article",
  enabled: () =>
    Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID),
  async fetchTopic(topic) {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.search = new URLSearchParams({
      key: process.env.GOOGLE_CSE_API_KEY!,
      cx: process.env.GOOGLE_CSE_ID!,
      q: topic.label,
      num: "10",
      dateRestrict: "m3",
    }).toString();
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Google Custom Search responded ${res.status}`);
    const data = (await res.json()) as { items?: SearchItem[] };

    return (data.items ?? [])
      .filter((i): i is SearchItem & { link: string; title: string } =>
        Boolean(i.link?.startsWith("http") && i.title),
      )
      .map((i, index): Candidate => {
        const meta = i.pagemap?.metatags?.[0] ?? {};
        const published = new Date(
          meta["article:published_time"] ?? meta["og:updated_time"] ?? "",
        );
        const publishedAt = Number.isNaN(published.getTime())
          ? 0
          : published.getTime();
        const image = i.pagemap?.cse_image?.[0]?.src;
        return {
          medium: "article",
          topic: topic.label,
          // Google gives relevance order, not counts — rank position is the score.
          engagement: 10 - index,
          publishedAt,
          resource: {
            id: `web-${i.link}`,
            title: i.title,
            description: i.snippet ?? "",
            category: [topic.label],
            contentType: "Article",
            medium: "article",
            source: i.displayLink ?? new URL(i.link).hostname.replace(/^www\./, ""),
            readingTime: 4, // unknown; typical short-read estimate
            publishedDate: publishedAt
              ? new Date(publishedAt).toISOString()
              : new Date().toISOString(),
            url: i.link,
            image: image?.startsWith("http") ? image : undefined,
            reason: `Picked from across the web for your interest in ${topic.label}`,
            reasonTopic: topic.label,
            kind: "web" as const,
          },
        };
      });
  },
};
