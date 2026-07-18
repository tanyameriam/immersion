import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { extractContent, type ClientCapture } from "@/lib/ai/extract-content";
import { analyzeContent } from "@/lib/ai/analyze";
import { AI_MODEL } from "@/lib/ai/claude";
import type { AiFields } from "@/lib/types/knowledge-item";

const COLLECTION = "knowledgeItems";

/**
 * Process one knowledge item end-to-end: claim it transactionally
 * (pending/failed/stale-processing → processing), fetch + extract the page,
 * run Claude, then write the AI fields and mark it completed. On any failure
 * the item is marked `failed` (with an incremented retryCount) so a later
 * sweep can retry it. Safe to call concurrently - the transactional claim
 * prevents two workers from processing the same item.
 */
export async function processItem(id: string): Promise<void> {
  const ref = adminDb().collection(COLLECTION).doc(id);

  // 1. Atomically claim the item.
  const claimed = await adminDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const data = doc.data()!;
    const status = data.status as string;

    const staleMs = 3 * 60 * 1000;
    const startedAt = data.processingStartedAt?.toMillis?.() ?? 0;
    const isStaleProcessing =
      status === "processing" && Date.now() - startedAt > staleMs;

    if (status !== "pending" && status !== "failed" && !isStaleProcessing) {
      return null; // someone else owns it, or it's already done
    }

    tx.update(ref, {
      status: "processing",
      processingStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      url: data.url as string,
      // Page content captured in the saver's browser (extension), if any.
      clientContent: (data.clientContent ?? null) as ClientCapture | null,
    };
  });

  if (!claimed) return; // not ours to process

  // 2. Extract + analyze (outside the transaction - these are slow/networked).
  let content: Awaited<ReturnType<typeof extractContent>> | null = null;
  try {
    content = await extractContent(claimed.url, claimed.clientContent ?? undefined);

    // Bot-challenge page: there is no real content and nothing honest to
    // summarize. Keep the title the save came with (the extension sends the
    // real tab title), skip Claude entirely, and mark the item blocked so the
    // dashboard says so instead of showing a summary of a loading screen.
    if (content.blocked) {
      await ref.update({
        status: "completed",
        blocked: true,
        ai: null,
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const analysis = await analyzeContent({
      title: content.title,
      text: content.text,
    });

    const ai: AiFields = {
      ...analysis,
      readingTime: content.readingTime,
      wordCount: content.wordCount,
      degraded: content.degraded,
      aiModel: AI_MODEL,
    };

    await ref.update({
      // The client-capture path returns an empty title when the page had no
      // og:title; keep the tab title the save already carries in that case.
      ...(content.title ? { title: content.title } : {}),
      description: content.description,
      image: content.image,
      blocked: false,
      // Recognized videos/podcasts update the saved type so the dashboard's
      // Medium filter actually matches them (items are created as "article").
      ...(content.medium ? { type: content.medium } : {}),
      // Denormalized lowercase copies of ai.topics/ai.keywords: the composite
      // indexes in firestore.indexes.json point at these top-level fields, so
      // search and the bot's retrieval can array-contains-any against them.
      topics: (analysis.topics ?? []).map((t) => t.toLowerCase().trim()),
      keywords: (analysis.keywords ?? []).map((k) => k.toLowerCase().trim()),
      status: "completed",
      ai,
      error: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`processItem failed for ${id}`, err);
    await ref.update({
      // Salvage whatever metadata extraction produced before the failure so
      // the bookmark still shows a real title/description instead of its URL.
      ...(content
        ? {
            ...(content.title ? { title: content.title } : {}),
            description: content.description,
            image: content.image,
          }
        : {}),
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
      retryCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Process several items with limited concurrency (used by the sweep route). */
export async function processItems(ids: string[], concurrency = 3): Promise<void> {
  const queue = [...ids];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      if (id) await processItem(id);
    }
  });
  await Promise.all(workers);
}
