"use client";

import { useState } from "react";
import {
  BookmarkPlus,
  ExternalLink,
  MoreVertical,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { ResourceDetail } from "@/components/dashboard/ResourceDetail";
import { MediumBadge } from "@/components/dashboard/MediumBadge";
import { MediaThumbnail } from "@/components/dashboard/MediaThumbnail";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Resource } from "@/lib/dashboard-data";
import type { ResourceView } from "@/components/dashboard/ViewToggle";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ResourceCardProps = {
  resource: Resource;
  variant: "bookmark" | "recommendation";
  view?: ResourceView;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  onReport?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onLike?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMuteTopic?: (id: string) => void;
};

function OverflowMenu({
  resource,
  onRemove,
  onMarkRead,
  onReport,
}: Pick<ResourceCardProps, "resource" | "onRemove" | "onMarkRead" | "onReport">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        render={<Button variant="ghost" size="icon-sm" />}
      >
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onMarkRead?.(resource.id)}>
          Mark as Read
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigator.clipboard?.writeText(resource.url)}
        >
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: resource.title, url: resource.url });
            } else {
              navigator.clipboard?.writeText(resource.url);
            }
          }}
        >
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReport?.(resource.id)}>
          Report Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onRemove?.(resource.id)}>
          Remove Bookmark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One-click feedback on recommendation cards: 👍 interested (more like
 * this), 👎 not interested (hide this link), plus a menu to mute the topic
 * it was recommended for. All three teach the engine what to show. */
function RecommendationActions({
  resource,
  onLike,
  onDismiss,
  onMuteTopic,
}: Pick<ResourceCardProps, "resource" | "onLike" | "onDismiss" | "onMuteTopic">) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Interested — show more like this"
        title="Interested — show more like this"
        aria-pressed={liked}
        onClick={() => {
          setLiked(true);
          onLike?.(resource.id);
        }}
      >
        <ThumbsUp className={liked ? "fill-current" : undefined} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Not interested"
        title="Not interested"
        onClick={() => onDismiss?.(resource.id)}
      >
        <ThumbsDown />
      </Button>
      {resource.reasonTopic && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More feedback options"
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onMuteTopic?.(resource.id)}>
              Hide topic: {resource.reasonTopic}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function OpenLinkButton({
  resource,
  size = "sm" as const,
  variant = "default" as const,
  className,
}: {
  resource: Resource;
  size?: "sm";
  variant?: "default" | "outline";
  className?: string;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      nativeButton={false}
      render={<a href={resource.url} target="_blank" rel="noreferrer" />}
    >
      Open Link
      <ExternalLink data-icon="inline-end" />
    </Button>
  );
}

export function ResourceCard({
  resource,
  variant,
  view = "grid",
  selected = false,
  onToggleSelect,
  onRemove,
  onMarkRead,
  onReport,
  onBookmark,
  onLike,
  onDismiss,
  onMuteTopic,
}: ResourceCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isBookmark = variant === "bookmark";
  const toggleDetail = () => setDetailOpen((o) => !o);
  // Keep cards scannable: a few topic pills, never a wall of them.
  const topicPills = resource.category.slice(0, 3);
  const moreTopics = resource.category.length - topicPills.length;
  // Medium is shown as a badge, so the meta line only carries source + time.
  const metaLine = [resource.source, `${resource.readingTime} min`]
    .filter(Boolean)
    .join(" · ");
  const dateLine = isBookmark
    ? [
        `Published ${formatDate(resource.publishedDate)}`,
        resource.savedDate && `Saved ${formatDate(resource.savedDate)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : `Published ${formatDate(resource.publishedDate)}`;
  // Single-line metadata for the list card: source + read time only.
  // Bookmarks also carry saved/published date (genuinely useful — when did
  // I save this); recommendations hide it, since it's rarely time-sensitive
  // and the recommendation badge already covers the "why now" context.
  const metaCombined = isBookmark
    ? [metaLine, dateLine].filter(Boolean).join(" · ")
    : metaLine;

  // The AI summary opens in a modal (portal) so it reads the same from either
  // view; clicking the title, the image, or the Summary button opens it.
  const detailDialog = (
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="normal-case tracking-normal">
            {resource.title}
          </DialogTitle>
          <DialogDescription>{metaLine}</DialogDescription>
        </DialogHeader>
        <ResourceDetail resource={resource} />
        <DialogFooter>
          <OpenLinkButton resource={resource} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // List view: an editorial horizontal card — a 320px media frame that
  // bleeds flush to the card's left/top/bottom edges (so it's pixel-identical
  // whether it's a real thumbnail or the icon fallback) and stretches to
  // match the row's full height, with a content column vertically centered
  // alongside it. Content (not artwork) is the hero, but every thumbnail
  // still gets cropped into the same frame so the media never falls short
  // of (or overflows past) the card.
  if (view === "list") {
    return (
      <Card size="sm" className="border border-border py-0">
        <div className="flex h-[236px] min-h-0 min-w-0 items-center gap-6 overflow-hidden">
          {isBookmark && onToggleSelect && (
            <Checkbox
              className="ml-5"
              checked={selected}
              onCheckedChange={() => onToggleSelect(resource.id)}
              aria-label={`Select ${resource.title}`}
            />
          )}

          <MediaThumbnail
            image={resource.image}
            contentType={resource.contentType}
            title={resource.title}
            onClick={toggleDetail}
          />

          <div className="flex min-w-0 flex-1 flex-col py-5 pr-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
                <MediumBadge label={resource.contentType} />
                {resource.blocked && resource.status === "completed" && (
                  <Badge
                    variant="outline"
                    title="This site blocks automated readers, so there is no summary."
                  >
                    Couldn&apos;t read
                  </Badge>
                )}
                {resource.degraded && resource.status === "completed" && (
                  <Badge
                    variant="outline"
                    title="This site would not let Layrrrd read the full content."
                  >
                    Limited info
                  </Badge>
                )}
                {topicPills.map((cat) => (
                  <Badge key={cat} variant="secondary">
                    {cat}
                  </Badge>
                ))}
                {moreTopics > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    +{moreTopics} more
                  </span>
                )}
              </div>
              {/* Feedback actions (like/dislike/more) stay top-right; Save
                  lives in the button row below instead. */}
              <div className="flex shrink-0 items-center gap-1">
                {variant === "recommendation" ? (
                  <RecommendationActions
                    resource={resource}
                    onLike={onLike}
                    onDismiss={onDismiss}
                    onMuteTopic={onMuteTopic}
                  />
                ) : (
                  <OverflowMenu
                    resource={resource}
                    onRemove={onRemove}
                    onMarkRead={onMarkRead}
                    onReport={onReport}
                  />
                )}
              </div>
            </div>

            {!isBookmark && resource.reason && (
              <span className="mt-2 inline-flex w-fit items-center gap-1.5 bg-muted px-2.5 py-1 text-xs font-medium normal-case tracking-normal text-foreground">
                <Sparkles className="size-3" />
                {resource.reason}
              </span>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleDetail}
                className="line-clamp-1 text-left text-lg font-bold tracking-[-0.01em] text-foreground hover:underline"
              >
                {resource.title}
              </button>
              {isBookmark && resource.read && (
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Read
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">{metaCombined}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={toggleDetail}>
                <Sparkles data-icon="inline-start" />
                Key Insights
              </Button>
              {variant === "recommendation" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBookmark?.(resource.id)}
                >
                  <BookmarkPlus data-icon="inline-start" />
                  Bookmark
                </Button>
              )}
            </div>
          </div>
        </div>
        {detailDialog}
      </Card>
    );
  }

  return (
    <Card size="sm" className="pt-0">
      <MediaThumbnail
        image={resource.image}
        contentType={resource.contentType}
        title={resource.title}
        onClick={toggleDetail}
        variant="grid"
      />
      <CardHeader>
        <div className="flex items-center justify-end gap-1">
          {isBookmark ? (
            <OverflowMenu
              resource={resource}
              onRemove={onRemove}
              onMarkRead={onMarkRead}
              onReport={onReport}
            />
          ) : (
            <RecommendationActions
              resource={resource}
              onLike={onLike}
              onDismiss={onDismiss}
              onMuteTopic={onMuteTopic}
            />
          )}
        </div>

        <div className="flex items-start gap-3">
          {isBookmark && onToggleSelect && (
            <Checkbox
              className="mt-1"
              checked={selected}
              onCheckedChange={() => onToggleSelect(resource.id)}
              aria-label={`Select ${resource.title}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="normal-case tracking-normal">
                <button
                  type="button"
                  onClick={toggleDetail}
                  className="line-clamp-2 text-left hover:underline"
                >
                  {resource.title}
                </button>
              </CardTitle>
              {isBookmark && resource.read && (
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Read
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        {!isBookmark && resource.reason && (
          <p className="text-sm font-bold text-foreground">
            {resource.reason}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <MediumBadge label={resource.contentType} />
          {resource.blocked && resource.status === "completed" && (
            <Badge
              variant="outline"
              title="This site blocks automated readers, so there is no summary."
            >
              Couldn&apos;t read
            </Badge>
          )}
          {resource.degraded && resource.status === "completed" && (
            <Badge
              variant="outline"
              title="This site would not let Layrrrd read the full content."
            >
              Limited info
            </Badge>
          )}
          {topicPills.map((cat) => (
            <Badge key={cat} variant="secondary">
              {cat}
            </Badge>
          ))}
          {moreTopics > 0 && (
            <span className="text-xs text-muted-foreground">
              +{moreTopics} more
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{metaLine}</p>
        <p className="text-sm text-muted-foreground">{dateLine}</p>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button size="sm" className="w-full" onClick={toggleDetail}>
          Summary
        </Button>
        {variant === "recommendation" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onBookmark?.(resource.id)}
          >
            <BookmarkPlus data-icon="inline-start" />
            Bookmark
          </Button>
        )}
      </CardFooter>
      {detailDialog}
    </Card>
  );
}
