"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type FilterGroup = {
  key: string;
  label: string;
  options: string[];
};

export function FilterMenu({
  groups,
  selected,
  onChange,
  onClear,
}: {
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  onChange: (groupKey: string, option: string, checked: boolean) => void;
  onClear: () => void;
}) {
  const activeCount = Object.values(selected).reduce(
    (sum, values) => sum + values.length,
    0
  );

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {activeCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const id = `${group.key}-${option}`;
                  const checked = selected[group.key]?.includes(option) ?? false;
                  return (
                    <div key={option} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) =>
                          onChange(group.key, option, next === true)
                        }
                      />
                      <Label htmlFor={id}>{option}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onClear}
          >
            Clear Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
