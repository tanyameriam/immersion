"use client";

import { useMemo, useState } from "react";
import { Search, Compass, Globe, Sparkles, type LucideIcon } from "lucide-react";
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
import { LoadingDog } from "@/components/LoadingDog";
import { type Resource } from "@/lib/dashboard-data";
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
 * A subtle secondary section of suggestions ("Explore something new", "Fresh
 * from around the web"). Uses the same recommendation card so a click flows
 * through the real save path.
 */
function SuggestionSection({
  icon: Icon,
  title,
  description,
  items,
  onBookmark,
  onLike,
  onDismiss,
  onMuteTopic,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  items: Resource[];
  onBookmark: (id: string) => void;
  onLike: (id: string) => void;
  onDismiss: (id: string) => void;
  onMuteTopic: (id: string) => void;
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
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
  web,
  loading,
}: {
  onBookmark: (resource: Resource) => void;
  /** 👍 "Interested" — adopt this card's topic into the user's interests. */
  onLike?: (resource: Resource) => void;
  /** 👎 "Not interested" — never suggest this link again. */
  onDismiss?: (resource: Resource) => void;
  /** Hide the topic this card was recommended for. */
  onMuteTopic?: (resource: Resource) => void;
  /** Real recommendations to show (community items matched to interests). */
  items?: Resource[];
  /** Popular items in topics the user hasn't picked yet — a gentle nudge. */
  discover?: Resource[];
  /** Mixed-medium picks from around the web, matched to the user's taste. */
  web?: Resource[];
  /** True while the feed is being fetched; shows a loading state, not empty. */
  loading?: boolean;
}) {
  const source = useMemo(() => items ?? [], [items]);
  const discoverList = useMemo(() => discover ?? [], [discover]);
  const webList = useMemo(() => web ?? [], [web]);
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
  const hasWeb = webList.length > 0;

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
      discoverList.find((item) => item.id === id) ??
      webList.find((item) => item.id === id)
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

  if (!hasMatched && !hasDiscover && !hasWeb) {
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
          No topic matches yet, but here are a few fresh things worth a look.
        </p>
      )}

      {hasWeb && (
        <SuggestionSection
          icon={Globe}
          title="Fresh from around the web"
          description="Articles, videos and podcasts matched to your taste, from sources like Medium, YouTube and Spotify. Each one says why it's here."
          items={webList}
          onBookmark={handleBookmark}
          onLike={handleLike}
          onDismiss={handleDismiss}
          onMuteTopic={handleMuteTopic}
        />
      )}

      {hasDiscover && (
        <SuggestionSection
          icon={Sparkles}
          title="Explore something new"
          description="Outside your usual topics, saved by people who share your taste. Save one to add it to your interests."
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
