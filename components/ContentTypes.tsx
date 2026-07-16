import { GraduationCap, Headphones, Newspaper, Sparkles, Video } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";

const contentTypes = [
  { title: "Articles", icon: Newspaper },
  { title: "Videos", icon: Video },
  { title: "Podcasts", icon: Headphones },
  { title: "Research Papers", icon: GraduationCap },
  { title: "Anything You Save", icon: Sparkles },
];

export default function ContentTypes() {
  return (
    <section
      id="content-types"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            Everything worth saving.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.65] text-muted-foreground">
            Save articles, videos, podcasts, research papers, and more.
            Layrrrd keeps everything in one place, ready to retrieve whenever
            you need it.
          </p>
        </FadeUp>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 md:gap-5">
          {contentTypes.map(({ title, icon: Icon }, i) => (
            <FadeUp key={title} delay={i * 0.06}>
              <div className="flex h-full flex-col items-center gap-4 border border-border bg-card px-6 py-10 text-center shadow-sm transition-shadow hover:shadow-md">
                <Icon className="size-7 text-foreground" strokeWidth={1.5} />
                <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                  {title}
                </h3>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
