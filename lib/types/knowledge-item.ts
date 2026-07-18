import { z } from "zod";

/**
 * A Knowledge Item is anything a user saves (article, video, PDF, …).
 * Designed generically so we can grow beyond articles without a data migration.
 */

/**
 * What kind of content an item is. Legacy docs may hold other free-form
 * strings (everything was "article" in V1), so treat unknown values as
 * "article" when reading.
 */
export const ITEM_MEDIUMS = ["article", "video", "podcast"] as const;
export type ItemMedium = (typeof ITEM_MEDIUMS)[number];

export const PROCESSING_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SENTIMENTS = ["Positive", "Neutral", "Negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/**
 * The structured JSON we require Claude to return. Validated with zod so a
 * malformed response marks the item `failed` and gets retried.
 */
/** One titled section of the structured summary: an optional short paragraph
 * plus optional points, each with a bold lead-in and its substance. */
export const SummarySectionSchema = z.object({
  heading: z.string(),
  body: z.string().optional(),
  points: z
    .array(z.object({ title: z.string().optional(), body: z.string() }))
    .optional(),
});
export type SummarySection = z.infer<typeof SummarySectionSchema>;

export const AiAnalysisSchema = z.object({
  summary: z.string(),
  // Structured quick-read of the content. Optional because items analyzed
  // before these fields existed don't have them (keyPoints was a short-lived
  // flat-list predecessor of sections).
  sections: z.array(SummarySectionSchema).optional(),
  takeaways: z.array(z.string()).optional(),
  keyPoints: z.array(z.string()).optional(),
  tldr: z.string(),
  topics: z.array(z.string()),
  keywords: z.array(z.string()),
  difficulty: z.enum(DIFFICULTIES),
  sentiment: z.enum(SENTIMENTS),
});
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

/**
 * The AI-derived fields stored on a knowledge item. `readingTime` and
 * `wordCount` are computed deterministically server-side (not by Claude).
 */
export interface AiFields extends AiAnalysis {
  readingTime: number; // minutes
  wordCount: number;
  degraded: boolean; // true when we fell back to meta tags (paywall/JS pages)
  aiModel: string;
}

/**
 * A stored knowledge item. Timestamps are ISO strings at the API boundary
 * (Firestore Timestamps are converted on read/write in the data layer).
 */
export interface KnowledgeItem {
  id: string;
  userId: string;
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  domain: string;
  type: string; // "article" for MVP
  status: ProcessingStatus;
  isFavorite: boolean;
  isArchived: boolean;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  processingStartedAt: string | null;
  retryCount: number;
  ai: AiFields | null;
  error: string | null;
  /** User's own comment on the save (e.g. sent alongside a link in Telegram or WhatsApp). */
  note?: string;
  /** True when the site served a bot challenge instead of the page, so the
   * item was saved as a plain bookmark with no AI summary. */
  blocked?: boolean;
}

/** Payload the extension / web app sends to save a page. Oversized title and
 * favicon values are trimmed or dropped rather than rejected: a page with a
 * huge document.title or a giant data-URI favicon should never fail a save. */
export const SaveItemInputSchema = z.object({
  url: z.string().url().max(2048),
  title: z
    .string()
    .optional()
    .transform((s) => (s ? s.slice(0, 500) : s)),
  favicon: z
    .string()
    .optional()
    .transform((s) => (s && s.length <= 2048 ? s : undefined)),
  note: z.string().max(2000).optional(),
  /** Page content captured in the saver's own browser (extension). Oversized
   * values are trimmed, not rejected, same as title/favicon above. */
  content: z
    .object({
      title: z
        .string()
        .optional()
        .transform((s) => (s ? s.slice(0, 500) : undefined)),
      text: z
        .string()
        .optional()
        .transform((s) => (s ? s.slice(0, 20_000) : undefined)),
      description: z
        .string()
        .optional()
        .transform((s) => (s ? s.slice(0, 1000) : undefined)),
      image: z
        .string()
        .optional()
        .transform((s) =>
          s && s.length <= 2048 && /^https?:\/\//.test(s) ? s : undefined,
        ),
    })
    .optional(),
});
export type SaveItemInput = z.infer<typeof SaveItemInputSchema>;
