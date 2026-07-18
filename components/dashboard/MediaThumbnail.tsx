import { getContentTypeIcon } from "@/components/dashboard/MediumBadge";
import { cn } from "@/lib/utils";

type MediaThumbnailProps = {
  image?: string;
  contentType: string;
  title: string;
  onClick?: () => void;
  /** "list" = fixed 320px-wide side frame that stretches to match the row's
   * full height; "grid" = full-width aspect-video top banner. Both fall
   * back to the same centered content-type icon. */
  variant?: "list" | "grid";
};

/**
 * Media frame used by every recommendation/bookmark card, so the feed keeps
 * one consistent rhythm no matter the source image's original dimensions —
 * always crops to cover, never stretches. Falls back to a centered
 * content-type icon in the same frame when there's no thumbnail, so card
 * height and alignment never depend on whether a source image exists.
 */
export function MediaThumbnail({
  image,
  contentType,
  title,
  onClick,
  variant = "list",
}: MediaThumbnailProps) {
  const ContentIcon = getContentTypeIcon(contentType);
  const isGrid = variant === "grid";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${title}`}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-muted",
        // Both sit flush against the card's own edges (top/left/bottom for
        // list, top for grid), so the image and icon fallback render as
        // pixel-identical boxes — no radius, matching the design system.
        isGrid ? "aspect-video w-full border-b border-border" : "w-[320px] self-stretch"
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          className="size-full object-cover object-center"
        />
      ) : (
        <ContentIcon
          className={cn("text-muted-foreground", isGrid ? "size-10" : "size-12")}
          strokeWidth={1.5}
        />
      )}
    </button>
  );
}
