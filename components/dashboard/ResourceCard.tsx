"use client";

import { BookmarkPlus, ExternalLink, MoreVertical } from "lucide-react";
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
}: ResourceCardProps) {
  const isBookmark = variant === "bookmark";
  const metaLine = [
    resource.contentType,
    resource.source,
    `${resource.readingTime} min`,
  ].join(" · ");
  const dateLine = isBookmark
    ? [
        `Published ${formatDate(resource.publishedDate)}`,
        resource.savedDate && `Saved ${formatDate(resource.savedDate)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : `Published ${formatDate(resource.publishedDate)}`;

  if (view === "list") {
    return (
      <div className="flex items-center gap-4 py-4">
        {isBookmark && onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(resource.id)}
            aria-label={`Select ${resource.title}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">
              {resource.title}
            </h3>
            {resource.category.map((cat) => (
              <Badge key={cat} variant="secondary">
                {cat}
              </Badge>
            ))}
            {isBookmark && resource.read && (
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Read
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {metaLine} · {dateLine}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {variant === "recommendation" && (
            <Button size="sm" variant="ghost" onClick={() => onBookmark?.(resource.id)}>
              <BookmarkPlus data-icon="inline-start" />
              Bookmark
            </Button>
          )}
          <OpenLinkButton resource={resource} />
          {isBookmark && (
            <OverflowMenu
              resource={resource}
              onRemove={onRemove}
              onMarkRead={onMarkRead}
              onReport={onReport}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Card size="sm" className="h-full">
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
                {resource.title}
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

        {isBookmark && (
          <CardAction>
            <OverflowMenu
              resource={resource}
              onRemove={onRemove}
              onMarkRead={onMarkRead}
              onReport={onReport}
            />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {resource.category.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {resource.category.map((cat) => (
              <Badge key={cat} variant="secondary">
                {cat}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{metaLine}</p>
        <p className="text-sm text-muted-foreground">{dateLine}</p>
      </CardContent>

      <CardFooter className="gap-2">
        <OpenLinkButton resource={resource} />
        {variant === "recommendation" && (
          <Button size="sm" onClick={() => onBookmark?.(resource.id)}>
            <BookmarkPlus data-icon="inline-start" />
            Bookmark
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
