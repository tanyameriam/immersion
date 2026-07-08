"use client";

import { Badge } from "@/components/ui/badge";
import type { Resource } from "@/lib/dashboard-data";

/**
 * Inline expanded detail shown within a card (no modal): the full AI summary,
 * keywords, difficulty, and sentiment. Keeps the user in the page flow.
 */
export function ResourceDetail({ resource }: { resource: Resource }) {
  const processing =
    resource.status === "pending" || resource.status === "processing";

  if (processing) {
    return (
      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        Layrrrd is still reading this. The summary will appear here in a moment.
      </div>
    );
  }

  const facts = [resource.difficulty, resource.sentiment].filter(Boolean);

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {resource.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {resource.summary}
        </p>
      )}

      {resource.sections?.map((section) => (
        <div key={section.heading} className="space-y-2">
          <p className="text-sm font-bold text-foreground">{section.heading}</p>
          {section.body && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {section.body}
            </p>
          )}
          {section.points && section.points.length > 0 && (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              {section.points.map((point) => (
                <li key={point.body}>
                  {point.title && (
                    <span className="font-semibold">{point.title} — </span>
                  )}
                  {point.body}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {resource.takeaways && resource.takeaways.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Takeaways</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            {resource.takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items summarized before sections existed have a flat key-point list. */}
      {!resource.sections?.length &&
        resource.keyPoints &&
        resource.keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Key points
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              {resource.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
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
