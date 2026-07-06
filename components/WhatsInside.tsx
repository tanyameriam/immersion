import { FadeUp } from "@/components/FadeUp";

const features = [
  {
    title: "Your Saved Links",
    subtitle: "No digging through bookmarks.",
    description:
      "Everything you've sent to Layrrrd during the week, all in one place.",
  },
  {
    title: "AI Prioritization",
    subtitle: "Not everything deserves your time.",
    description: "Layrrrd surfaces what matters most first.",
  },
  {
    title: "Curated Picks",
    subtitle: "Never an empty digest.",
    description:
      "Even if you haven't saved anything yet, you'll receive carefully selected design resources from our team.",
  },
  {
    title: "Personalized Digest",
    subtitle: "Adapts to how you read.",
    description:
      "The more you save, the more your weekly digest reflects your interests.",
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
