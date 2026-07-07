"use client";

import { Badge } from "@/components/ui/badge";
import type { Resource } from "@/lib/dashboard-data";

/**
 * Inline expanded detail shown within a card (no modal) — the full AI summary,
 * keywords, difficulty, and sentiment. Keeps the user in the page flow.
 */
export function ResourceDetail({ resource }: { resource: Resource }) {
  const processing =
    resource.status === "pending" || resource.status === "processing";

  if (processing) {
    return (
      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        Layrrrd is still reading this — the summary will appear here in a moment.
      </div>
    );
  }

  const facts = [resource.difficulty, resource.sentiment].filter(Boolean);

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {resource.summary && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Summary
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {resource.summary}
          </p>
        </div>
      )}

      {resource.keywords && resource.keywords.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Keywords
          </p>
          <p className="text-sm text-muted-foreground">
            {resource.keywords.join(", ")}
          </p>
        </div>
      )}

      {facts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {facts.map((f) => (
            <Badge key={f} variant="outline">
              {f}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
