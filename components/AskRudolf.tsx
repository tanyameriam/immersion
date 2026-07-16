import Image from "next/image";
import { FadeUp } from "@/components/FadeUp";

export default function AskRudolf() {
  return (
    <section
      id="ask-rudolf"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            Ask Rudolf.
            <br />
            Fetch anything you&apos;ve saved.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.65] text-muted-foreground">
            Stop scrolling through endless bookmarks. Just ask Rudolf what
            you&apos;re looking for, and it&apos;ll fetch the right article,
            video, or resource from your library in seconds.
          </p>
        </FadeUp>

        <FadeUp delay={0.1} className="mt-16 md:mt-20">
          <Image
            src="/ask-rudolf.png"
            alt="Rudolf fetching a saved bookmark on request, shown across a Layrrrd dashboard and a Telegram chat"
            width={1992}
            height={891}
            className="h-auto w-full"
          />
        </FadeUp>
      </div>
    </section>
  );
}
