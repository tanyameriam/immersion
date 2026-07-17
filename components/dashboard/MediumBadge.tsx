import {
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  MessagesSquare,
  Play,
  Podcast,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS: Record<string, LucideIcon> = {
  Article: FileText,
  Video: Play,
  Podcast: Podcast,
  Book: BookOpen,
  Event: Calendar,
  Course: GraduationCap,
  Thread: MessagesSquare,
  Tool: Wrench,
  "Case Study": ClipboardList,
  Resource: BookOpen,
};

/** Icon representing a content type, for the medium badge and the 64px
 * icon container that stands in for a thumbnail. Falls back to a generic
 * link icon for legacy/unrecognized labels. */
export function getContentTypeIcon(label: string): LucideIcon {
  return ICONS[label] ?? LinkIcon;
}

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
