import type { ItemMedium } from "@/lib/types/knowledge-item";

/**
 * Starter lists are static, editorially curated sets of well-known content
 * shown once during onboarding (taste calibration). One Firestore doc per
 * topic at `starterLists/{slug}`, seeded from scripts/data/starter-lists/
 * by scripts/seed-starter-lists.mjs and refreshed manually.
 */

export interface StarterItem {
  /** Stable id derived from the url by the seeder. */
  id: string;
  title: string;
  url: string;
  /** Human source name, e.g. "NN/g", "The Futur". */
  source: string;
  medium: ItemMedium;
  image?: string;
  /** Minutes to read/watch/listen. */
  readingTime?: number;
}

export interface StarterListDoc {
  topic: string;
  updatedAt: string;
  items: StarterItem[];
}

/** A starter item the user selected, stored on users/{uid}.starterPicks. */
export interface StarterPick {
  id: string;
  topicSlug: string;
  title: string;
  url: string;
  medium: ItemMedium;
  source: string;
}
