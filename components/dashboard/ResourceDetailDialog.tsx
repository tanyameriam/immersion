"use client";

import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Resource } from "@/lib/dashboard-data";

/**
 * Per-card detail view: shows the full AI summary, TL;DR, topics, keywords, and
 * metadata, with a button to open the original article.
 */
export function ResourceDetailDialog({
  resource,
  open,
  onOpenChange,
}: {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const processing =
    resource.status === "pending" || resource.status === "processing";
  const meta = [
    resource.source,
    `${resource.readingTime} min read`,
    resource.difficulty,
    resource.sentiment,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="normal-case tracking-tight">
            {resource.title}
          </DialogTitle>
          {meta.length > 0 && (
            <DialogDescription>{meta.join(" · ")}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {processing ? (
            <p className="text-sm text-muted-foreground">
              Layrrrd is still reading this article. Check back in a few
              seconds.
            </p>
          ) : (
            <>
              {resource.description && (
                <p className="text-base font-medium text-foreground">
                  {resource.description}
                </p>
              )}

              {resource.summary && (
                <div className="space-y-2">
                  <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
                    Summary
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">
                    {resource.summary}
                  </p>
                </div>
              )}

              {resource.category.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
                    Topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resource.category.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {resource.keywords && resource.keywords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
                    Keywords
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resource.keywords.join(", ")}
                  </p>
                </div>
              )}
            </>
          )}

          <Separator />

          <Button
            className="w-full"
            nativeButton={false}
            render={
              <a href={resource.url} target="_blank" rel="noreferrer" />
            }
          >
            Open original article
            <ExternalLink data-icon="inline-end" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
