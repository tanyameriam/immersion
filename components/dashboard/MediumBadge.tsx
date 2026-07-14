import { FileText, Play, Podcast, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS: Record<string, LucideIcon> = {
  Article: FileText,
  Video: Play,
  Podcast: Podcast,
};

/**
 * Small outline badge naming an item's medium (Article / Video / Podcast).
 * Accepts the display label (`resource.contentType`); legacy values from old
 * bookmarks ("Tool", "Case Study", …) render as a plain text badge.
 */
export function MediumBadge({ label }: { label: string }) {
  if (!label) return null;
  const Icon = ICONS[label];
  return (
    <Badge variant="outline" className="gap-1">
      {Icon ? <Icon className="size-3" /> : null}
      {label}
    </Badge>
  );
}
