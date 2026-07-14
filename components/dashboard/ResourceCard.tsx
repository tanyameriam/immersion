"use client";

import { useState } from "react";
import {
  BookmarkPlus,
  ExternalLink,
  MoreVertical,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { ResourceDetail } from "@/components/dashboard/ResourceDetail";
import { MediumBadge } from "@/components/dashboard/MediumBadge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
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

function OpenLinkButton({ resource, size = "sm" as const }: { resource: Resource; size?: "sm" }) {
  return (
    <Button
      size={size}
      variant="outline"
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

  // List view: a full-width horizontal card — thumbnail left, content and
  // actions right — stacked vertically by the parent with gaps.
  if (view === "list") {
    return (
      <Card size="sm" className="flex-row gap-0 py-0">
        {resource.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.image}
            alt=""
            loading="lazy"
            onClick={toggleDetail}
            className="hidden w-44 shrink-0 cursor-pointer border-r border-border object-cover sm:block md:w-56"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
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
                <button
                  type="button"
                  onClick={toggleDetail}
                  className="text-left text-base font-bold text-foreground hover:underline"
                >
                  {resource.title}
                </button>
                {isBookmark && resource.read && (
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Read
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <MediumBadge label={resource.contentType} />
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
              {!isBookmark && resource.reason && (
                <p className="mt-1 text-sm font-bold text-foreground">
                  {resource.reason}
                </p>
              )}
              {resource.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {resource.description}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {metaLine} · {dateLine}
              </p>
            </div>
            <div className="shrink-0">
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
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={toggleDetail}>
              Summary
            </Button>
            <OpenLinkButton resource={resource} />
            {variant === "recommendation" && (
              <Button size="sm" onClick={() => onBookmark?.(resource.id)}>
                <BookmarkPlus data-icon="inline-start" />
                Bookmark
              </Button>
            )}
          </div>
        </div>
        {detailDialog}
      </Card>
    );
  }

  return (
    <Card size="sm">
      {resource.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resource.image}
          alt=""
          loading="lazy"
          onClick={toggleDetail}
          className="aspect-video w-full cursor-pointer border-b border-border object-cover"
        />
      )}
      <CardHeader>
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
                  className="text-left hover:underline"
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
            <CardDescription className="mt-1 line-clamp-2">
              {resource.description}
            </CardDescription>
          </div>
        </div>

        {isBookmark ? (
          <CardAction>
            <OverflowMenu
              resource={resource}
              onRemove={onRemove}
              onMarkRead={onMarkRead}
              onReport={onReport}
            />
          </CardAction>
        ) : (
          <CardAction>
            <RecommendationActions
              resource={resource}
              onLike={onLike}
              onDismiss={onDismiss}
              onMuteTopic={onMuteTopic}
            />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {!isBookmark && resource.reason && (
          <p className="text-sm font-bold text-foreground">
            {resource.reason}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <MediumBadge label={resource.contentType} />
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

      <CardFooter className="gap-2">
        <Button size="sm" variant="ghost" onClick={toggleDetail}>
          Summary
        </Button>
        <OpenLinkButton resource={resource} />
        {variant === "recommendation" && (
          <Button size="sm" onClick={() => onBookmark?.(resource.id)}>
            <BookmarkPlus data-icon="inline-start" />
            Bookmark
          </Button>
        )}
      </CardFooter>
      {detailDialog}
    </Card>
  );
}
