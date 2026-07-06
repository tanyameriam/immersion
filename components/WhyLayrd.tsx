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
              You don&apos;t have <br /> a discovery <br /> problem.
            </h2>
            <h2 className="mt-16 text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              You have <br /> a revisit <br /> problem.
            </h2>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="text-lg leading-[1.65] text-muted-foreground md:pt-2">
            <p>
              Every day you save something worth reading. Then it disappears
              into bookmarks, screenshots, browser tabs, Telegram chats, or
              Notes.
            </p>
            <p className="mt-4">
              Layrrrd gives those forgotten saves a second life by turning
              them into a curated weekly reading list — so the best things
              you found actually get read.
            </p>
            <p className="mt-4 font-bold text-foreground">
              Save once. Revisit intentionally.
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
