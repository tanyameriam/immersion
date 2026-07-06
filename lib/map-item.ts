import type { KnowledgeItem } from "@/lib/types/knowledge-item";
import type { Resource } from "@/lib/dashboard-data";

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
        : "");

  return {
    id: item.id,
    title: item.title || item.url,
    description,
    category: item.ai?.topics ?? [],
    contentType: capitalize(item.type || "Article"),
    source: item.domain || "",
    readingTime: item.ai?.readingTime ?? 0,
    publishedDate: item.createdAt || new Date().toISOString(),
    savedDate: item.createdAt || undefined,
    url: item.url,
    read: false,
    summary: item.ai?.summary,
    keywords: item.ai?.keywords,
    difficulty: item.ai?.difficulty,
    sentiment: item.ai?.sentiment,
    status: item.status,
  };
}
