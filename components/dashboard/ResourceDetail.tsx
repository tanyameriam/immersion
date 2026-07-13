"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import type { Resource } from "@/lib/dashboard-data";
import type { AiFields } from "@/lib/types/knowledge-item";

/**
 * Inline expanded detail shown within a card (no modal): the full AI summary,
 * keywords, difficulty, and sentiment. Keeps the user in the page flow.
 *
 * Saved items carry their AI fields already. Unsaved feed picks (kind "web")
 * were never processed, so their summary is fetched on demand from
 * /api/web-summary (cached by URL server-side) the first time this opens.
 */
export function ResourceDetail({ resource }: { resource: Resource }) {
  const processing =
    resource.status === "pending" || resource.status === "processing";
  // Videos and podcasts have no readable article text to summarize; their
  // own descriptions are the honest content, so don't fetch for those.
  const isUnsummarizedPick =
    resource.kind === "web" &&
    !resource.summary &&
    resource.medium !== "video" &&
    resource.medium !== "podcast";

  const [webAi, setWebAi] = useState<AiFields | null>(null);
  const [webState, setWebState] = useState<"loading" | "error" | "done">(
    "loading",
  );

  useEffect(() => {
    if (!isUnsummarizedPick) return;
    let cancelled = false;
    setWebState("loading");
    apiFetch(`/api/web-summary?url=${encodeURIComponent(resource.url)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`web-summary ${res.status}`);
        const data = (await res.json()) as { summary: { ai: AiFields } };
        if (cancelled) return;
        setWebAi(data.summary.ai);
        setWebState("done");
      })
      .catch((err) => {
        console.error("web summary failed", err);
        if (!cancelled) setWebState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isUnsummarizedPick, resource.url]);

  if (processing) {
    return (
      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        Layrrrd is still reading this. The summary will appear here in a moment.
      </div>
    );
  }

  if (isUnsummarizedPick && webState === "loading") {
    return (
      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        Reading this one for you, the summary will appear in a moment…
      </div>
    );
  }

  if (isUnsummarizedPick && webState === "error") {
    return (
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t read this link just now, it may be paywalled or blocking
          us. Here&apos;s what we know:
        </p>
        {resource.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {resource.description}
          </p>
        )}
      </div>
    );
  }

  // Unsaved picks render the freshly fetched fields; saved items their own.
  const r: Resource = webAi
    ? {
        ...resource,
        summary: webAi.summary,
        sections: webAi.sections,
        takeaways: webAi.takeaways,
        keyPoints: webAi.keyPoints,
        keywords: webAi.keywords,
        difficulty: webAi.difficulty,
        sentiment: webAi.sentiment,
      }
    : resource;

  const facts = [r.difficulty, r.sentiment].filter(Boolean);

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {r.note && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Your note</p>
          <p className="whitespace-pre-line text-sm italic leading-relaxed text-muted-foreground">
            {r.note}
          </p>
        </div>
      )}

      {r.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {r.summary}
        </p>
      )}

      {/* Nothing summarized (e.g. an unsaved video or podcast pick): the
          source's own description is the most honest detail we have. */}
      {!r.summary &&
        !r.sections?.length &&
        !r.takeaways?.length &&
        !r.keyPoints?.length &&
        r.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {r.description}
          </p>
        )}

      {r.sections?.map((section) => (
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

      {r.takeaways && r.takeaways.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Takeaways</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            {r.takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items summarized before sections existed have a flat key-point list. */}
      {!r.sections?.length && r.keyPoints && r.keyPoints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Key points
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            {r.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {r.keywords && r.keywords.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Keywords
          </p>
          <p className="text-sm text-muted-foreground">
            {r.keywords.join(", ")}
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
