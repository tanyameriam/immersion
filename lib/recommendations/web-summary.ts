import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { extractContent } from "@/lib/ai/extract-content";
import { analyzeContent } from "@/lib/ai/analyze";
import {
  fetchYouTubeDescription,
  fetchYouTubeTranscript,
  spotifyEpisodeId,
  youTubeVideoId,
} from "@/lib/ai/media-content";
import { watchYouTubeVideo } from "@/lib/ai/gemini-video";
import { fetchSpotifyEpisode } from "@/lib/recommendations/sources/spotify";
import { AI_MODEL } from "@/lib/ai/claude";
import type { AiFields } from "@/lib/types/knowledge-item";

/**
 * On-demand summaries for feed items the user hasn't saved. Same extract +
 * analyze pipeline as bookmarks, but cached by URL in a shared collection:
 * recommendations are the same for everyone, so one Claude call serves every
 * user who opens that pick's summary.
 *
 * Media picks summarize the actual content, not the landing page: YouTube
 * videos use the caption transcript (sections become timestamped chapters);
 * Spotify episodes use the full episode description.
 */

const COLLECTION = "webSummaries";

/** extractContent never throws; below this many words there is nothing real
 * to summarize and Claude would be invited to make things up. */
const MIN_WORDS = 50;

const WORDS_PER_MINUTE = 225;

type SummarySource = {
  title: string;
  image: string;
  text: string;
  readingTime: number;
  wordCount: number;
  degraded: boolean;
  kind: "article" | "transcript";
};

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

async function loadSummarySource(url: string): Promise<SummarySource> {
  const videoId = youTubeVideoId(url);
  if (videoId) {
    // oEmbed (inside extractContent) supplies real title/thumbnail; the
    // transcript supplies the substance.
    const [content, transcript] = await Promise.all([
      extractContent(url),
      fetchYouTubeTranscript(videoId),
    ]);
    if (transcript) {
      return {
        title: content.title,
        image: content.image,
        text: transcript,
        readingTime: content.readingTime,
        wordCount: countWords(transcript),
        degraded: false,
        kind: "transcript",
      };
    }
    // No captions: have Gemini watch the actual video (official YouTube URL
    // input) and return timestamped notes — still a true content summary.
    const watched = await watchYouTubeVideo(url);
    if (watched) {
      return {
        title: content.title,
        image: content.image,
        text: watched,
        readingTime: content.readingTime,
        wordCount: countWords(watched),
        degraded: false,
        kind: "transcript",
      };
    }
    // Next best: the official Data API description (long-form videos usually
    // include one, often with chapters) — about the video, not its content.
    const detail = await fetchYouTubeDescription(videoId);
    if (detail && countWords(detail.description) >= MIN_WORDS) {
      return {
        title: content.title,
        image: content.image,
        text: detail.description,
        readingTime: detail.durationMinutes,
        wordCount: countWords(detail.description),
        degraded: true, // description, not the full spoken content
        kind: "article",
      };
    }
    // Last resort: whatever the page's meta tags exposed.
    return { ...content, kind: "article" };
  }

  const episodeId = spotifyEpisodeId(url);
  if (episodeId) {
    const episode = await fetchSpotifyEpisode(episodeId);
    if (episode && countWords(episode.description) >= MIN_WORDS) {
      return {
        title: episode.name,
        image: episode.image ?? "",
        text: episode.description,
        readingTime: episode.durationMs
          ? Math.max(1, Math.round(episode.durationMs / 60000))
          : 0,
        wordCount: countWords(episode.description),
        // Descriptions tell what's covered, not everything said — flag it.
        degraded: true,
        kind: "article",
      };
    }
    // No API keys or thin description: try the page's own meta tags.
    return { ...(await extractContent(url)), kind: "article" };
  }

  const content = await extractContent(url);
  return {
    title: content.title,
    image: content.image,
    text: content.text,
    readingTime: content.readingTime,
    wordCount: content.wordCount,
    degraded: content.degraded,
    kind: "article",
  };
}

export type WebSummary = {
  url: string;
  title: string;
  image: string;
  ai: AiFields;
};

export async function getWebSummary(url: string): Promise<WebSummary> {
  const id = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const ref = adminDb().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const { url: u, title, image, ai } = snap.data() as WebSummary;
    return { url: u, title, image, ai };
  }

  const source = await loadSummarySource(url);
  if (source.wordCount < MIN_WORDS) {
    throw new Error(`Not enough readable content at ${url}`);
  }
  const analysis = await analyzeContent({
    title: source.title,
    text: source.text,
    kind: source.kind,
  });
  const summary: WebSummary = {
    url,
    title: source.title,
    image: source.image,
    ai: {
      ...analysis,
      readingTime:
        source.readingTime ||
        Math.max(1, Math.round(source.wordCount / WORDS_PER_MINUTE)),
      wordCount: source.wordCount,
      degraded: source.degraded,
      aiModel: AI_MODEL,
    },
  };
  await ref.set({ ...summary, createdAt: Timestamp.now() });
  return summary;
}
