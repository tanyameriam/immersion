"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Search, BookmarkX } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toResource } from "@/lib/map-item";
import type { KnowledgeItem } from "@/lib/types/knowledge-item";
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
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ViewToggle, type ResourceView } from "@/components/dashboard/ViewToggle";
import {
  matchesDateSaved,
  matchesReadingTime,
  type Resource,
} from "@/lib/dashboard-data";
import {
  CATEGORIES,
  CONTENT_TYPES,
  READING_TIME_BUCKETS,
  DATE_SAVED_BUCKETS,
} from "@/lib/constants";

const SORT_OPTIONS = [
  "Recently Saved",
  "Oldest Saved",
  "Recently Published",
  "Alphabetical (A–Z)",
  "Reading Time",
];

function sortResources(list: Resource[], sort: string) {
  const sorted = [...list];
  switch (sort) {
    case "Oldest Saved":
      return sorted.sort(
        (a, b) =>
          new Date(a.savedDate ?? 0).getTime() -
          new Date(b.savedDate ?? 0).getTime()
      );
    case "Recently Published":
      return sorted.sort(
        (a, b) =>
          new Date(b.publishedDate).getTime() -
          new Date(a.publishedDate).getTime()
      );
    case "Alphabetical (A–Z)":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "Reading Time":
      return sorted.sort((a, b) => a.readingTime - b.readingTime);
    case "Recently Saved":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.savedDate ?? 0).getTime() -
          new Date(a.savedDate ?? 0).getTime()
      );
  }
}

export function BookmarksTab({
  items,
  setItems,
  onExploreRecommendations,
  onRemovePersist,
  onMarkReadPersist,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: Resource[];
  setItems: Dispatch<SetStateAction<Resource[]>>;
  onExploreRecommendations: () => void;
  /** Persist a removal to the backend (Firestore). Optional for mock usage. */
  onRemovePersist?: (ids: string[]) => void;
  /** Persist read status to the backend. Optional for mock usage. */
  onMarkReadPersist?: (ids: string[]) => void;
  /** True when older bookmarks exist beyond the loaded window. */
  hasMore?: boolean;
  /** True while the next page of older bookmarks is loading. */
  loadingMore?: boolean;
  /** Fetch and append the next page of older bookmarks. */
  onLoadMore?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Recently Saved");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ResourceView>("grid");
  // Server-side keyword search over the WHOLE library (the search box itself
  // only filters what's loaded). Keyed by the query it was run for, so stale
  // results never leak into a different search.
  const [serverResults, setServerResults] = useState<{
    query: string;
    resources: Resource[];
  } | null>(null);
  const [serverSearching, setServerSearching] = useState(false);

  async function searchAllBookmarks() {
    const q = search.trim();
    if (!q || serverSearching) return;
    setServerSearching(true);
    try {
      const res = await apiFetch(`/api/items/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`search ${res.status}`);
      const data = (await res.json()) as { items: KnowledgeItem[] };
      setServerResults({ query: q, resources: (data.items ?? []).map(toResource) });
    } catch (err) {
      console.error("Search all bookmarks failed", err);
      setServerResults({ query: q, resources: [] });
    } finally {
      setServerSearching(false);
    }
  }

  // Loaded items plus any server matches for the current query (deduped).
  const searchable = useMemo(() => {
    if (!serverResults || serverResults.query !== search.trim()) return items;
    const seen = new Set(items.map((i) => i.id));
    return [...items, ...serverResults.resources.filter((r) => !seen.has(r.id))];
  }, [items, serverResults, search]);

  const sources = useMemo(
    () => Array.from(new Set(searchable.map((item) => item.source))).sort(),
    [searchable]
  );

  const filterGroups: FilterGroup[] = [
    { key: "category", label: "Category", options: CATEGORIES },
    { key: "contentType", label: "Medium", options: CONTENT_TYPES },
    { key: "readingTime", label: "Reading Time", options: READING_TIME_BUCKETS },
    { key: "dateSaved", label: "Date Saved", options: DATE_SAVED_BUCKETS },
    { key: "source", label: "Source", options: sources },
  ];

  // Server matches hit on AI keywords/topics, not necessarily the visible
  // text, so they skip the substring test (other filters still apply).
  const serverMatchedIds = useMemo(() => {
    if (!serverResults || serverResults.query !== search.trim())
      return new Set<string>();
    return new Set(serverResults.resources.map((r) => r.id));
  }, [serverResults, search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return searchable.filter((item) => {
      if (
        query &&
        !serverMatchedIds.has(item.id) &&
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
      if (
        filters.readingTime?.length &&
        !filters.readingTime.some((bucket) =>
          matchesReadingTime(item.readingTime, bucket)
        )
      ) {
        return false;
      }
      if (
        filters.dateSaved?.length &&
        !filters.dateSaved.some((bucket) =>
          matchesDateSaved(item.savedDate, bucket)
        )
      ) {
        return false;
      }
      if (filters.source?.length && !filters.source.includes(item.source)) {
        return false;
      }
      return true;
    });
  }, [searchable, search, filters, serverMatchedIds]);

  const sorted = useMemo(() => sortResources(filtered, sort), [filtered, sort]);

  function handleFilterChange(groupKey: string, option: string, checked: boolean) {
    setFilters((prev) => {
      const current = prev[groupKey] ?? [];
      const next = checked
        ? [...current, option]
        : current.filter((v) => v !== option);
      return { ...prev, [groupKey]: next };
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeBookmarks(ids: string[]) {
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    onRemovePersist?.(ids);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function markRead(ids: string[]) {
    setItems((prev) =>
      prev.map((item) =>
        ids.includes(item.id) ? { ...item, read: true } : item
      )
    );
    onMarkReadPersist?.(ids);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BookmarkX}
        title="No bookmarks yet"
        description="Save useful resources from Layrrrd to build your personal design library."
        actionLabel="Explore Recommendations"
        onAction={onExploreRecommendations}
      />
    );
  }

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

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted px-4 py-3">
          <span className="text-sm font-bold text-foreground">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => markRead(Array.from(selected))}
            >
              Mark as Read
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeBookmarks(Array.from(selected))}
            >
              Remove Bookmarks
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {search.trim() && hasMore && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={searchAllBookmarks}
            disabled={serverSearching}
          >
            {serverSearching ? "Searching…" : "Search all bookmarks"}
          </Button>
          <p className="text-sm text-muted-foreground">
            The box above filters what&apos;s loaded. This searches your whole
            library by topic and keyword.
          </p>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No bookmarks match your search and filters.
        </p>
      ) : view === "list" ? (
        <div className="flex flex-col gap-4">
          {sorted.map((item) => (
            <ResourceCard
              key={item.id}
              resource={item}
              variant="bookmark"
              view="list"
              selected={selected.has(item.id)}
              onToggleSelect={toggleSelect}
              onRemove={(id) => removeBookmarks([id])}
              onMarkRead={(id) => markRead([id])}
              onReport={() => {}}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <ResourceCard
              key={item.id}
              resource={item}
              variant="bookmark"
              view="grid"
              selected={selected.has(item.id)}
              onToggleSelect={toggleSelect}
              onRemove={(id) => removeBookmarks([id])}
              onMarkRead={(id) => markRead([id])}
              onReport={() => {}}
            />
          ))}
        </div>
      )}

      {(hasMore || loadingMore) && (
        <div className="flex flex-col items-center gap-2 pb-4">
          <p className="text-sm text-muted-foreground">
            Showing your latest {items.length} saves.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onLoadMore?.()}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
