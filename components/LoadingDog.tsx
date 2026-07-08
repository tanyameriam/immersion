"use client";

/**
 * Full-area loading state: a line-art dog running smoothly in place on a
 * scrolling ground, in the Layrrrd editorial style (ink on cream). Used while
 * auth resolves and pages load.
 */
export function LoadingDog({ label = "Fetching your knowledge…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 bg-background">
      <div className="loading-dog" aria-hidden>
        <svg viewBox="0 0 160 110" width="180" height="124" role="img">
          {/* body bobs up and down */}
          <g className="dog-body">
            {/* tail */}
            <path
              className="dog-tail"
              d="M32 46 C18 40 14 30 20 24"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* torso */}
            <path
              d="M34 46 C40 34 66 30 92 34 C104 36 112 40 118 44 C122 47 120 58 112 60 L44 60 C36 60 30 54 34 46 Z"
              fill="#f4f1ea"
              stroke="#1a1a1a"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            {/* neck + head */}
            <path
              d="M110 44 C120 34 132 32 140 36 C148 40 146 52 138 54 C132 55 126 54 120 52"
              fill="#f4f1ea"
              stroke="#1a1a1a"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            {/* ear */}
            <path
              className="dog-ear"
              d="M130 36 C128 26 134 22 140 24"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* eye */}
            <circle cx="136" cy="42" r="2.6" fill="#1a1a1a" />
            {/* snout */}
            <circle cx="147" cy="45" r="2.6" fill="#e8623b" />

            {/* legs - gallop cycle, two phases */}
            <line className="leg leg-a" x1="52" y1="60" x2="52" y2="84" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
            <line className="leg leg-b" x1="66" y1="60" x2="66" y2="84" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
            <line className="leg leg-b" x1="98" y1="60" x2="98" y2="84" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
            <line className="leg leg-a" x1="110" y1="60" x2="110" y2="84" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          </g>

          {/* ground dashes scroll to imply forward motion */}
          <g className="ground">
            <line x1="0" y1="92" x2="22" y2="92" stroke="#c9c3b6" strokeWidth="4" strokeLinecap="round" />
            <line x1="40" y1="92" x2="62" y2="92" stroke="#c9c3b6" strokeWidth="4" strokeLinecap="round" />
            <line x1="80" y1="92" x2="102" y2="92" stroke="#c9c3b6" strokeWidth="4" strokeLinecap="round" />
            <line x1="120" y1="92" x2="142" y2="92" stroke="#c9c3b6" strokeWidth="4" strokeLinecap="round" />
            <line x1="160" y1="92" x2="182" y2="92" stroke="#c9c3b6" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <p className="text-sm tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>

      <style jsx>{`
        .dog-body {
          transform-origin: 80px 60px;
          animation: dog-bob 0.42s ease-in-out infinite;
        }
        .leg {
          transform-origin: top center;
        }
        .leg-a {
          animation: gallop 0.42s ease-in-out infinite;
        }
        .leg-b {
          animation: gallop 0.42s ease-in-out infinite;
          animation-delay: 0.21s;
        }
        .dog-tail {
          transform-origin: 32px 46px;
          animation: wag 0.42s ease-in-out infinite;
        }
        .dog-ear {
          transform-origin: 132px 34px;
          animation: wag 0.42s ease-in-out infinite;
        }
        .ground line {
          animation: scroll 0.6s linear infinite;
        }
        @keyframes dog-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes gallop {
          0% {
            transform: rotate(28deg);
          }
          50% {
            transform: rotate(-28deg);
          }
          100% {
            transform: rotate(28deg);
          }
        }
        @keyframes wag {
          0%,
          100% {
            transform: rotate(6deg);
          }
          50% {
            transform: rotate(-10deg);
          }
        }
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-40px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dog-body,
          .leg,
          .dog-tail,
          .dog-ear,
          .ground line {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
