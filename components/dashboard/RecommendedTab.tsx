"use client";

import { useMemo, useState } from "react";
import { Search, Compass, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Input } from "@/components/ui/input";
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
import { recommendations, type Resource } from "@/lib/dashboard-data";
import { CATEGORIES, CONTENT_TYPES, READING_TIME_BUCKETS } from "@/lib/constants";

const SORT_OPTIONS = ["Most Relevant", "Newest", "Trending", "Reading Time"];

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
    case "Trending":
    case "Most Relevant":
    default:
      return sorted;
  }
}

/**
 * A subtle secondary section nudging the user toward topics they haven't picked.
 * Uses the same recommendation card so a click flows through the real save path.
 */
function DiscoverSection({
  items,
  onBookmark,
  onLike,
  onDismiss,
  onMuteTopic,
}: {
  items: Resource[];
  onBookmark: (id: string) => void;
  onLike: (id: string) => void;
  onDismiss: (id: string) => void;
  onMuteTopic: (id: string) => void;
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-medium text-foreground">
            Explore something new
          </h2>
          <p className="text-sm text-muted-foreground">
            Popular in topics outside your usual — save one to add it to your
            interests.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <ResourceCard
            key={item.id}
            resource={item}
            variant="recommendation"
            view="list"
            onBookmark={onBookmark}
            onLike={onLike}
            onDismiss={onDismiss}
            onMuteTopic={onMuteTopic}
          />
        ))}
      </div>
    </section>
  );
}

export function RecommendedTab({
  onBookmark,
  onLike,
  onDismiss,
  onMuteTopic,
  items,
  discover,
}: {
  onBookmark: (resource: Resource) => void;
  /** 👍 "Interested" — adopt this card's topic into the user's interests. */
  onLike?: (resource: Resource) => void;
  /** 👎 "Not interested" — never suggest this link again. */
  onDismiss?: (resource: Resource) => void;
  /** Hide the topic this card was recommended for. */
  onMuteTopic?: (resource: Resource) => void;
  /**
   * Real recommendations to show. Falls back to sample content until the
   * community-based recommendation engine exists (needs multiple users).
   */
  items?: Resource[];
  /** Popular items in topics the user hasn't picked yet — a gentle nudge. */
  discover?: Resource[];
}) {
  const source = useMemo(() => items ?? recommendations, [items]);
  const discoverList = useMemo(() => discover ?? [], [discover]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Most Relevant");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ResourceView>("list");

  const filterGroups: FilterGroup[] = [
    { key: "category", label: "Category", options: CATEGORIES },
    { key: "contentType", label: "Content Type", options: CONTENT_TYPES },
    { key: "readingTime", label: "Reading Time", options: READING_TIME_BUCKETS },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return source.filter((item) => {
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
  }, [source, search, filters]);

  const sorted = useMemo(() => sortResources(filtered, sort), [filtered, sort]);

  const hasMatched = source.length > 0;
  const hasDiscover = discoverList.length > 0;

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
    return (
      source.find((item) => item.id === id) ??
      discoverList.find((item) => item.id === id)
    );
  }

  function handleBookmark(id: string) {
    const resource = findResource(id);
    if (!resource) return;
    setBookmarkedIds((prev) => new Set(prev).add(id));
    onBookmark(resource);
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

  if (!hasMatched && !hasDiscover) {
    return (
      <EmptyState
        icon={Compass}
        title="No recommendations yet"
        description="Recommendations come from what people with similar interests save. Save a few articles, and as the community grows we'll surface links others like you are reading."
      />
    );
  }

  return (
    <div className="space-y-10">
      {hasMatched ? (
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
                <ResourceCard
                  key={item.id}
                  resource={item}
                  variant="recommendation"
                  view="list"
                  onBookmark={handleBookmark}
                  onLike={handleLike}
                  onDismiss={handleDismiss}
                  onMuteTopic={handleMuteTopic}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((item) => (
                <ResourceCard
                  key={item.id}
                  resource={item}
                  variant="recommendation"
                  view="grid"
                  onBookmark={handleBookmark}
                  onLike={handleLike}
                  onDismiss={handleDismiss}
                  onMuteTopic={handleMuteTopic}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No topic matches yet — here are a few fresh things worth a look.
        </p>
      )}

      {hasDiscover && (
        <DiscoverSection
          items={discoverList}
          onBookmark={handleBookmark}
          onLike={handleLike}
          onDismiss={handleDismiss}
          onMuteTopic={handleMuteTopic}
        />
      )}

      {bookmarkedIds.size > 0 && (
        <p className="text-sm text-muted-foreground">
          Saved {bookmarkedIds.size} recommendation
          {bookmarkedIds.size === 1 ? "" : "s"} to your bookmarks.
        </p>
      )}
    </div>
  );
}
