import { FadeUp } from "@/components/FadeUp";

const features = [
  {
    title: "Save From Anywhere",
    subtitle: "One click, any page.",
    description:
      "Articles, threads, videos, and shots go into Layrrrd the moment you find them, with the source and context kept intact.",
  },
  {
    title: "Read by AI",
    subtitle: "Skim in seconds, not minutes.",
    description:
      "Every save comes back with a summary, a one-line TL;DR, topics, and a reading time, so you know what's worth opening.",
  },
  {
    title: "Your Weekly Digest",
    subtitle: "The good stuff, resurfaced.",
    description:
      "Once a week, everything you saved returns grouped by topic and flagged by what you haven't read yet, so nothing slips away.",
  },
  {
    title: "Recommended For You",
    subtitle: "Discover beyond your own saves.",
    description:
      "Links that readers with your interests are saving surface alongside yours, curated picks with none of the noise.",
  },
];

export default function WhatsInside() {
  return (
    <section
      id="inside"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            Every week.
            <br />
            Everything worth revisiting.
          </h2>
        </FadeUp>

        <div className="mt-16 divide-y divide-border border-t border-b border-border">
          {features.map((feature, i) => (
            <FadeUp key={feature.title} delay={i * 0.06}>
              <div className="grid gap-2 py-10 md:grid-cols-[60px_1fr_1.4fr] md:items-start md:gap-8">
                <span className="text-sm text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-3xl font-bold tracking-[-0.02em] text-foreground md:text-4xl">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">
                    {feature.subtitle}
                  </p>
                </div>
                <p className="text-base leading-[1.65] text-muted-foreground md:pt-2">
                  {feature.description}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
