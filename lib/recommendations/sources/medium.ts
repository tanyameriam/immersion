import type { Candidate, SourceFetcher, TopicQuery } from "./types";
import { FETCH_TIMEOUT_MS, WORDS_PER_MINUTE } from "./types";

/**
 * Medium articles via per-tag RSS feeds (plus UX Collective for the topics it
 * covers). Medium has no public ranking API, so the documented heuristic is
 * recency: tag feeds are newest-first and `engagement` is the publish time,
 * which the feed builder turns into a within-batch percentile.
 */

/** Topics UX Collective (uxdesign.cc) reliably covers — used to decide
 * whether the user's interests justify pulling from that publication. */
const UX_COLLECTIVE_TOPICS = new Set(
  [
    "UX Design",
    "Product Design",
    "UI Design",
    "Design Systems",
    "UX Research",
    "Accessibility",
    "Interaction Design",
    "Web Design",
  ].map((t) => t.toLowerCase()),
);

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** First `<name>…</name>` in the block, CDATA unwrapped and entities decoded. */
function tagContent(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type FeedArticle = {
  title: string;
  url: string;
  description: string;
  publishedAt: number;
  readingTime: number;
};

/** Minimal RSS 2.0 parse — enough for Medium-style feeds, no XML dependency. */
function parseFeed(xml: string): FeedArticle[] {
  return xml
    .split(/<item[\s>]/)
    .slice(1)
    .map((block) => {
      const title = stripHtml(tagContent(block, "title"));
      // Medium appends ?source=rss… tracking — strip it so URLs match cleanly
      // against saves and dismissals.
      const url = tagContent(block, "link").split("?")[0];
      const body = stripHtml(tagContent(block, "content:encoded"));
      const text = (body || stripHtml(tagContent(block, "description")))
        // Medium's truncated feeds end every teaser with this boilerplate.
        .replace(/Continue reading on .*»\s*$/, "")
        .trim();
      const published = new Date(tagContent(block, "pubDate"));
      const words = body.split(/\s+/).filter(Boolean).length;
      return {
        title,
        url,
        description:
          text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text,
        publishedAt: Number.isNaN(published.getTime())
          ? 0
          : published.getTime(),
        // Word count is only meaningful when the feed carries the full article;
        // truncated feeds get a typical-short-read estimate instead.
        readingTime:
          words > 100 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 4,
      };
    })
    .filter((a) => a.title && a.url.startsWith("http"));
}

async function fetchFeed(url: string): Promise<FeedArticle[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // The feed builder caches parsed candidates; don't double-cache the fetch.
    cache: "no-store",
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`RSS ${url} responded ${res.status}`);
  return parseFeed(await res.text());
}

function toCandidate(
  a: FeedArticle,
  sourceName: string,
  topic: TopicQuery,
): Candidate {
  return {
    medium: "article",
    topic: topic.label,
    engagement: a.publishedAt,
    publishedAt: a.publishedAt,
    resource: {
      id: `web-${a.url}`,
      title: a.title,
      description: a.description,
      category: [topic.label],
      contentType: "Article",
      medium: "article",
      source: sourceName,
      readingTime: a.readingTime,
      publishedDate: a.publishedAt
        ? new Date(a.publishedAt).toISOString()
        : new Date().toISOString(),
      url: a.url,
      reason:
        sourceName === "Medium"
          ? `Trending on Medium because you're into ${topic.label}`
          : `Fresh on ${sourceName}, picked for your interest in ${topic.label}`,
      reasonTopic: topic.label,
      kind: "web" as const,
    },
  };
}

export const mediumSource: SourceFetcher = {
  id: "medium",
  medium: "article",
  enabled: () => true, // plain RSS, no keys
  async fetchTopic(topic) {
    const feeds: { url: string; sourceName: string }[] = [
      { url: `https://medium.com/feed/tag/${topic.slug}`, sourceName: "Medium" },
    ];
    if (UX_COLLECTIVE_TOPICS.has(topic.label.toLowerCase())) {
      feeds.push({ url: "https://uxdesign.cc/feed", sourceName: "UX Collective" });
    }
    const results = await Promise.allSettled(
      feeds.map((f) => fetchFeed(f.url)),
    );
    if (results.every((r) => r.status === "rejected")) {
      throw (results[0] as PromiseRejectedResult).reason;
    }
    return results.flatMap((r, i) =>
      r.status === "fulfilled"
        ? r.value.slice(0, 10).map((a) => toCandidate(a, feeds[i].sourceName, topic))
        : [],
    );
  },
};
