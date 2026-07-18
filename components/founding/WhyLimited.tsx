import { FadeUp } from "@/components/FadeUp";

export function FoundingWhyLimited() {
  return (
    <section
      id="why-100"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="grid items-center gap-16 md:grid-cols-2 md:gap-12">
          <FadeUp>
            <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
              Why 100
            </p>
            <h2 className="mt-4 text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              Small by design.
            </h2>
          </FadeUp>

          <FadeUp delay={0.08}>
            <div className="space-y-6 text-[17px] leading-[1.65] text-muted-foreground">
              <p>
                We&apos;re keeping the founding group intentionally small so
                every member can actually collaborate with us, not just use
                the product.
              </p>
              <p>
                A hundred people is a group we can talk to directly - in
                calls, in feedback threads, in the roadmap itself. Your
                experience with Layrrrd becomes the input for what we build
                next.
              </p>
              <p>
                Founding members aren&apos;t early adopters watching from the
                sidelines. They&apos;re helping build the product alongside
                us.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
