import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { extractContent } from "@/lib/ai/extract-content";
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
    return { url: data.url as string };
  });

  if (!claimed) return; // not ours to process

  // 2. Extract + analyze (outside the transaction - these are slow/networked).
  try {
    const content = await extractContent(claimed.url);
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
      title: content.title,
      description: content.description,
      image: content.image,
      status: "completed",
      ai,
      error: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`processItem failed for ${id}`, err);
    await ref.update({
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
