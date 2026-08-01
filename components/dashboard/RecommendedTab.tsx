"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Compass } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResourceCard } from "@/components/dashboard/ResourceCard";
import { FilterMenu, type FilterGroup } from "@/components/dashboard/FilterMenu";
import { ViewToggle, type ResourceView } from "@/components/dashboard/ViewToggle";
import { LoadingDog } from "@/components/LoadingDog";
import { type Resource } from "@/lib/dashboard-data";
import { CATEGORIES, CONTENT_TYPES, READING_TIME_BUCKETS } from "@/lib/constants";

const SORT_OPTIONS = ["Most Relevant", "Newest", "Reading Time"];

function sortResources(list: Resource[], sort: string) {
  const sorted = [...list];
  switch (sort) {
    case "Newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.publishedDate).getTime() -
          new Date(a.publishedDate).getTime()
      );
    case "Reading Time":
      return sorted.sort((a, b) => a.readingTime - b.readingTime);
    case "Most Relevant":
    default:
      return sorted; // woven order is the relevance order
  }
}

/**
 * One feed, not three sections: community matches and web picks alternate,
 * with a discover nudge woven in every few cycles. Deterministic and
 * append-stable, so infinite scroll extends the tail without reshuffling
 * what the user already scrolled past.
 */
function weaveFeed(
  matched: Resource[],
  web: Resource[],
  discover: Resource[],
): Resource[] {
  const out: Resource[] = [];
  const seen = new Set<string>();
  const push = (r?: Resource) => {
    if (r && !seen.has(r.url)) {
      seen.add(r.url);
      out.push(r);
    }
  };
  let mi = 0;
  let wi = 0;
  let di = 0;
  for (let cycle = 0; mi < matched.length || wi < web.length || di < discover.length; cycle++) {
    push(matched[mi++]);
    push(web[wi++]);
    if (cycle % 3 === 2) push(discover[di++]);
    // Only discover items left: drain them so the loop terminates.
    if (mi >= matched.length && wi >= web.length && cycle % 3 !== 2) {
      push(discover[di++]);
    }
  }
  return out;
}

export function RecommendedTab({
  onBookmark,
  onLike,
  onDismiss,
  onMuteTopic,
  items,
  discover,
  web,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  onBookmark: (resource: Resource) => void;
  /** 👍 "Interested" — adopt this card's topic into the user's interests. */
  onLike?: (resource: Resource) => void;
  /** 👎 "Not interested" — never suggest this link again. */
  onDismiss?: (resource: Resource) => void;
  /** Hide the topic this card was recommended for. */
  onMuteTopic?: (resource: Resource) => void;
  /** Community recommendations matched to the user's interests. */
  items?: Resource[];
  /** Popular items in topics the user hasn't picked yet — a gentle nudge. */
  discover?: Resource[];
  /** Mixed-medium picks from around the web, matched to the user's taste. */
  web?: Resource[];
  /** True while the feed is being fetched; shows a loading state, not empty. */
  loading?: boolean;
  /** True while the next page is being appended. */
  loadingMore?: boolean;
  /** Whether deeper pages exist. */
  hasMore?: boolean;
  /** Fetch and append the next page. */
  onLoadMore?: () => void;
}) {
  const matched = useMemo(() => items ?? [], [items]);
  const discoverList = useMemo(() => discover ?? [], [discover]);
  const webList = useMemo(() => web ?? [], [web]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Most Relevant");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [view, setView] = useState<ResourceView>("grid");

  const feed = useMemo(
    () => weaveFeed(matched, webList, discoverList),
    [matched, webList, discoverList],
  );

  const filterGroups: FilterGroup[] = [
    { key: "category", label: "Category", options: CATEGORIES },
    { key: "contentType", label: "Medium", options: CONTENT_TYPES },
    { key: "readingTime", label: "Reading Time", options: READING_TIME_BUCKETS },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feed.filter((item) => {
      if (
        query &&
        !item.title.toLowerCase().includes(query) &&
        !item.description.toLowerCase().includes(query) &&
        !item.source.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (
        filters.category?.length &&
        !filters.category.some((cat) => item.category.includes(cat))
      ) {
        return false;
      }
      if (
        filters.contentType?.length &&
        !filters.contentType.includes(item.contentType)
      ) {
        return false;
      }
      return true;
    });
  }, [feed, search, filters]);

  const sorted = useMemo(() => sortResources(filtered, sort), [filtered, sort]);

  // Infinite scroll: when the sentinel under the list becomes visible, pull
  // the next page. The button stays as an explicit fallback.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  function handleFilterChange(groupKey: string, option: string, checked: boolean) {
    setFilters((prev) => {
      const current = prev[groupKey] ?? [];
      const next = checked
        ? [...current, option]
        : current.filter((v) => v !== option);
      return { ...prev, [groupKey]: next };
    });
  }

  function findResource(id: string) {
    return feed.find((item) => item.id === id);
  }

  function handleBookmark(id: string) {
    const resource = findResource(id);
    if (resource) onBookmark(resource);
  }

  function handleLike(id: string) {
    const resource = findResource(id);
    if (resource) onLike?.(resource);
  }

  function handleDismiss(id: string) {
    const resource = findResource(id);
    if (resource) onDismiss?.(resource);
  }

  function handleMuteTopic(id: string) {
    const resource = findResource(id);
    if (resource) onMuteTopic?.(resource);
  }

  if (feed.length === 0) {
    if (loading) {
      return (
        <div className="py-16">
          <LoadingDog label="Building your feed…" />
        </div>
      );
    }
    return (
      <EmptyState
        icon={Compass}
        title="Your feed is warming up"
        description="Fresh picks based on your interests and starter selections will appear here shortly. Saving a few things you like sharpens it further."
      />
    );
  }

  const cardProps = {
    variant: "recommendation" as const,
    onBookmark: handleBookmark,
    onLike: handleLike,
    onDismiss: handleDismiss,
    onMuteTopic: handleMuteTopic,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description, source…"
            className="pl-6"
          />
        </div>

        <div className="flex items-center gap-3">
          <FilterMenu
            groups={filterGroups}
            selected={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters({})}
          />
          <Select value={sort} onValueChange={(v) => v && setSort(v)}>
            <SelectTrigger className="w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No recommendations match your search and filters.
        </p>
      ) : view === "list" ? (
        <div className="flex flex-col gap-4">
          {sorted.map((item) => (
            <ResourceCard key={item.id} resource={item} view="list" {...cardProps} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <ResourceCard key={item.id} resource={item} view="grid" {...cardProps} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      <div className="flex flex-col items-center gap-3 pb-4">
        {loadingMore ? (
          <LoadingDog label="Fetching more picks…" />
        ) : hasMore ? (
          <Button variant="outline" size="sm" onClick={() => onLoadMore?.()}>
            Load more
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re all caught up for now. Fresh picks arrive daily.
          </p>
        )}
      </div>
    </div>
  );
}
