import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";
import { toMedium } from "@/lib/medium-label";

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Map a real KnowledgeItem into the `Resource` shape the friend's dashboard
 * UI consumes. Items still being processed get a friendly placeholder so they
 * appear immediately after saving, then fill in once AI completes.
 */
export function toResource(item: KnowledgeItem): Resource {
  const processing = item.status === "pending" || item.status === "processing";
  const failed = item.status === "failed";

  const description =
    item.ai?.tldr ||
    item.description ||
    (processing
      ? "Summarizing with AI…"
      : failed
        ? "Couldn't read this link. It may be paywalled or private."
        : item.blocked
          ? "This site blocks automated readers, so there is no summary. Open the link to read it."
          : "");

  return {
    id: item.id,
    title: item.title || item.url,
    description,
    category: item.ai?.topics ?? [],
    contentType: capitalize(item.type || "Article"),
    medium: toMedium(item.type),
    source: item.domain || "",
    readingTime: item.ai?.readingTime ?? 0,
    publishedDate: item.createdAt || new Date().toISOString(),
    savedDate: item.createdAt || undefined,
    url: item.url,
    read: item.read,
    image: item.image || undefined,
    summary: item.ai?.summary,
    sections: item.ai?.sections,
    takeaways: item.ai?.takeaways,
    keyPoints: item.ai?.keyPoints,
    keywords: item.ai?.keywords,
    difficulty: item.ai?.difficulty,
    sentiment: item.ai?.sentiment,
    status: item.status,
    degraded: item.ai?.degraded ?? false,
    blocked: item.blocked ?? false,
    note: item.note,
  };
}
