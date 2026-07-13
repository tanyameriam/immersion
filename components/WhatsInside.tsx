import { FadeUp } from "@/components/FadeUp";

const features = [
  {
    title: "Discover what matters",
    subtitle: "Curated for your interests.",
    description:
      "Discover relevant articles, videos, newsletters, and research without the endless scrolling.",
  },
  {
    title: "Save effortlessly",
    subtitle: "One click. Any source.",
    description:
      "Everything you save is organized into one personal library, with context and source preserved.",
  },
  {
    title: "Ask instead of search",
    subtitle: "Find anything instantly.",
    description:
      "Forget folders and bookmarks. Ask a question, and Layrrrd retrieves exactly what you're looking for.",
  },
  {
    title: "Stay one step ahead",
    subtitle: "Personalized recommendations.",
    description:
      "Keep discovering trusted content tailored to your interests as your library grows.",
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
            Everything you save.
            <br />
            Ready when you need it.
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
