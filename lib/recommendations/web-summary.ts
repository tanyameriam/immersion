import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { extractContent } from "@/lib/ai/extract-content";
import { analyzeContent } from "@/lib/ai/analyze";
import { AI_MODEL } from "@/lib/ai/claude";
import type { AiFields } from "@/lib/types/knowledge-item";

/**
 * On-demand summaries for feed items the user hasn't saved. Same extract +
 * analyze pipeline as bookmarks, but cached by URL in a shared collection:
 * recommendations are the same for everyone, so one Claude call serves every
 * user who opens that pick's summary.
 */

const COLLECTION = "webSummaries";

/** extractContent never throws; below this many words there is nothing real
 * to summarize and Claude would be invited to make things up. */
const MIN_WORDS = 50;

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

  const content = await extractContent(url);
  if (content.wordCount < MIN_WORDS) {
    throw new Error(`Not enough readable content at ${url}`);
  }
  const analysis = await analyzeContent({
    title: content.title,
    text: content.text,
  });
  const summary: WebSummary = {
    url,
    title: content.title,
    image: content.image,
    ai: {
      ...analysis,
      readingTime: content.readingTime,
      wordCount: content.wordCount,
      degraded: content.degraded,
      aiModel: AI_MODEL,
    },
  };
  await ref.set({ ...summary, createdAt: Timestamp.now() });
  return summary;
}
