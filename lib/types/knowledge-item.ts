import { z } from "zod";

/**
 * A Knowledge Item is anything a user saves (article, video, PDF, …).
 * Designed generically so we can grow beyond articles without a data migration.
 */

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
export const AiAnalysisSchema = z.object({
  summary: z.string(),
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
  createdAt: string;
  updatedAt: string;
  processingStartedAt: string | null;
  retryCount: number;
  ai: AiFields | null;
  error: string | null;
}

/** Payload the extension / web app sends to save a page. */
export const SaveItemInputSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  favicon: z.string().optional(),
});
export type SaveItemInput = z.infer<typeof SaveItemInputSchema>;
