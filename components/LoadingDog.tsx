"use client";

/**
 * Full-area loading state: a running dog sprite animation in the Layrrrd
 * editorial style. The sprite sheet is a static asset (12 frames, 350×170 each,
 * 4200×170 total) served from /running-dog-sprite.png so the large image stays
 * out of the JS bundle. Rendered at native 1:1 resolution so the hand-drawn
 * outline stays crisp (downscaling averaged the thin strokes into fuzzy gray).
 * Used while auth resolves and pages load.
 */
export function LoadingDog({ label = "Fetching your knowledge…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 bg-background">
      <div className="running-dog" aria-hidden />
      <p className="text-sm tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>

      <style jsx>{`
        .running-dog {
          width: 350px;
          height: 170px;
          background-image: url("/running-dog-sprite.png");
          background-repeat: no-repeat;
          /* Native size => 1:1 pixel mapping, no downscale blur. */
          background-size: 4200px 170px;
          background-position: 0 0;
          animation: run-cycle 1s steps(12) infinite;
          /* Darken the light charcoal sketch strokes toward black. */
          filter: brightness(0.8) contrast(1.05);
        }
        @keyframes run-cycle {
          from {
            background-position-x: 0;
          }
          to {
            background-position-x: -4200px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .running-dog {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
