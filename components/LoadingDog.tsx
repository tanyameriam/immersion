"use client";

/**
 * Full-area loading state: a running dog illustration animation in the Layrrrd
 * look and feel. The animation is a looping WebP (converted from the source GIF
 * by scripts/build-loading-dog.mjs) served as a static asset from
 * /loading-dog.webp — far smaller than the source GIF and it self-animates as a
 * CSS background. A static poster frame is used under reduced-motion. Used while
 * auth resolves and pages load.
 */
export function LoadingDog({ label = "Fetching your knowledge…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 bg-background">
      <div className="running-dog" aria-hidden="true" />
      <p className="text-sm tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>

      <style jsx>{`
        .running-dog {
          width: min(350px, 82vw);
          aspect-ratio: 350 / 197;
          background-image: url("/loading-dog.webp");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .running-dog {
            background-image: url("/loading-dog-static.webp");
          }
        }
      `}</style>
    </div>
  );
}
