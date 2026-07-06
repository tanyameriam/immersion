"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueCard } from "@/components/dashboard/IssueCard";
import { FilterMenu, type FilterGroup } from "@/components/dashboard/FilterMenu";
import { weeklyIssues } from "@/lib/dashboard-data";

const SORT_OPTIONS = ["Newest First", "Oldest First"];

export function WeeklyIssuesTab() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Newest First");
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const months = useMemo(
    () =>
      Array.from(
        new Set(
          weeklyIssues.map((issue) =>
            new Date(issue.publishDate).toLocaleDateString("en-US", {
              month: "long",
            })
          )
        )
      ),
    []
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          weeklyIssues.map((issue) =>
            String(new Date(issue.publishDate).getFullYear())
          )
        )
      ),
    []
  );

  const filterGroups: FilterGroup[] = [
    { key: "month", label: "Month", options: months },
    { key: "year", label: "Year", options: years },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return weeklyIssues.filter((issue) => {
      if (query && !issue.title.toLowerCase().includes(query)) return false;
      const date = new Date(issue.publishDate);
      const month = date.toLocaleDateString("en-US", { month: "long" });
      const year = String(date.getFullYear());
      if (filters.month?.length && !filters.month.includes(month))
        return false;
      if (filters.year?.length && !filters.year.includes(year)) return false;
      return true;
    });
  }, [search, filters]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const diff =
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
      return sort === "Oldest First" ? -diff : diff;
    });
    return list;
  }, [filtered, sort]);

  function handleFilterChange(groupKey: string, option: string, checked: boolean) {
    setFilters((prev) => {
      const current = prev[groupKey] ?? [];
      const next = checked
        ? [...current, option]
        : current.filter((v) => v !== option);
      return { ...prev, [groupKey]: next };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
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
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No issues match your search and filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
