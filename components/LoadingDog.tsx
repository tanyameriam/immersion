"use client";

/**
 * Full-area loading state: a running dog sprite animation in the Layrrrd
 * editorial style. The sprite sheet is a static asset (12 frames, 220×107 each,
 * 2640×107 total) served from /running-dog-sprite.png so the large image stays
 * out of the JS bundle. Used while auth resolves and pages load.
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
          width: 220px;
          height: 107px;
          background-image: url("/running-dog-sprite.png");
          background-repeat: no-repeat;
          background-size: 2640px 107px;
          background-position: 0 0;
          animation: run-cycle 1s steps(12) infinite;
          image-rendering: -webkit-optimize-contrast;
        }
        @keyframes run-cycle {
          from {
            background-position-x: 0;
          }
          to {
            background-position-x: -2640px;
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
