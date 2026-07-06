"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ResourceView = "grid" | "list";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ResourceView;
  onChange: (view: ResourceView) => void;
}) {
  return (
    <div className="flex items-center border border-border">
      <Button
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
      >
        <List />
      </Button>
    </div>
  );
}
