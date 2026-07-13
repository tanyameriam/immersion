import { FadeUp } from "@/components/FadeUp";

export default function WhyLayrd() {
  return (
    <section
      id="why"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:grid-cols-2 md:gap-8 md:px-10 xl:px-20">
        <FadeUp>
          <div>
            <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              You don&apos;t have <br /> an information <br /> problem.
            </h2>
            <h2 className="mt-16 text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              You have <br /> a retrieval <br /> problem.
            </h2>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="text-lg leading-[1.65] text-muted-foreground md:pt-2">
            <p>
              The internet gives you more content than you could ever
              consume.
            </p>
            <p className="mt-4">
              Saving takes seconds. Finding it again takes minutes, or never
              happens at all.
            </p>
            <p className="mt-4">
              Most tools help you collect links. Layrrrd helps you turn them
              into knowledge you can actually use.
            </p>
            <p className="mt-4 font-bold text-foreground">
              Save once. Retrieve anytime.
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
