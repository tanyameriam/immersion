import { slugify } from "@/lib/constants";
import type { Resource } from "@/lib/dashboard-data";

/** How many web picks to surface alongside community recommendations. */
const MAX_WEB = 3;
/** Feeds are editorial content — refreshing a few times a day is plenty,
 * and the shared fetch cache keeps us from hammering the sources. */
const REVALIDATE_SECONDS = 6 * 60 * 60;
const FETCH_TIMEOUT_MS = 6000;
/** Average reading speed, for estimating minutes from feed content. */
const WORDS_PER_MINUTE = 225;

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

type Feed = {
  url: string;
  sourceName: string;
  /** The user interest this feed was chosen for — cited in the reason. */
  topic: string;
};

/**
 * Public sources matched to the user's strongest interests: a Medium tag feed
 * for each of their top two topics, plus UX Collective when their interests
 * are in its wheelhouse. All plain RSS — free, no API keys.
 */
function pickFeeds(rankedInterests: string[]): Feed[] {
  const feeds: Feed[] = rankedInterests.slice(0, 2).map((topic) => ({
    url: `https://medium.com/feed/tag/${slugify(topic)}`,
    sourceName: "Medium",
    topic,
  }));
  const uxTopic = rankedInterests.find((t) =>
    UX_COLLECTIVE_TOPICS.has(t.toLowerCase()),
  );
  if (uxTopic) {
    feeds.push({
      url: "https://uxdesign.cc/feed",
      sourceName: "UX Collective",
      topic: uxTopic,
    });
  }
  return feeds;
}

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
  publishedDate: string;
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
        publishedDate: Number.isNaN(published.getTime())
          ? new Date().toISOString()
          : published.toISOString(),
        // Word count is only meaningful when the feed carries the full article;
        // truncated feeds get a typical-short-read estimate instead.
        readingTime:
          words > 100 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 4,
      };
    })
    .filter((a) => a.title && a.url.startsWith("http"));
}

async function fetchFeed(feed: Feed): Promise<Resource[]> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text()).map((a) => ({
      id: `web-${a.url}`,
      title: a.title,
      description: a.description,
      category: [feed.topic],
      contentType: "Article",
      source: feed.sourceName,
      readingTime: a.readingTime,
      publishedDate: a.publishedDate,
      url: a.url,
      reason:
        feed.sourceName === "Medium"
          ? `Trending on Medium because you're into ${feed.topic}`
          : `Fresh on ${feed.sourceName}, picked for your interest in ${feed.topic}`,
      reasonTopic: feed.topic,
      kind: "web" as const,
    }));
  } catch {
    return []; // a slow or down feed never blocks recommendations
  }
}

/**
 * Top public articles from around the web, picked for the user's strongest
 * interests. Complements community recommendations (which can only surface
 * what other users have saved) and always says why each pick is shown.
 */
export async function buildWebRecommendations(
  rankedInterests: string[],
  excludedUrls: Set<string>,
): Promise<Resource[]> {
  const feeds = pickFeeds(rankedInterests);
  if (feeds.length === 0) return [];
  const perFeed = await Promise.all(feeds.map(fetchFeed));

  // Round-robin across feeds (each is newest-first) so one prolific source
  // doesn't take every slot.
  const picks: Resource[] = [];
  const seen = new Set<string>();
  for (let i = 0; perFeed.some((f) => i < f.length); i++) {
    for (const articles of perFeed) {
      const a = articles[i];
      if (!a || seen.has(a.url) || excludedUrls.has(a.url)) continue;
      seen.add(a.url);
      picks.push(a);
      if (picks.length >= MAX_WEB) return picks;
    }
  }
  return picks;
}
