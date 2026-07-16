"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useAuth } from "@/components/AuthContext";

const TAGLINES = [
  ["Good things, saved.", "Better things, fetched."],
  ["Articles. Videos. Podcasts. Papers.", "Just ask Rudolf."],
];

export default function Hero() {
  const { user, openAuth } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((i) => (i + 1) % TAGLINES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Normalized cursor position relative to the viewport center (-0.5 .. 0.5).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.6 });

  // The dog leans and drifts toward the cursor for a subtle "it noticed you" feel.
  const dogX = useTransform(sx, [-0.5, 0.5], [-26, 26]);
  const dogY = useTransform(sy, [-0.5, 0.5], [-16, 16]);
  const dogRotate = useTransform(sx, [-0.5, 0.5], [-7, 7]);

  useEffect(() => {
    if (reduceMotion) return;
    function onMove(e: MouseEvent) {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [px, py, reduceMotion]);

  return (
    <section className="flex h-screen flex-col pt-[72px]">
      <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        <div className="flex flex-1 flex-col justify-center px-6 md:px-10 xl:px-20">
          <FadeUp>
            <p
              className="font-bold leading-none tracking-[-0.05em] text-foreground"
              style={{ fontSize: "clamp(4.5rem, 14vw, 13rem)" }}
            >
              Layrrrd.
            </p>
          </FadeUp>

          <FadeUp delay={0.08}>
            <div
              className="mt-4 md:mt-6"
              style={{
                fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)",
                lineHeight: 0.98,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.h1
                  key={taglineIndex}
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 16 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -16 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="font-bold tracking-[-0.04em] text-foreground"
                >
                  {TAGLINES[taglineIndex][0]}
                  <br />
                  {TAGLINES[taglineIndex][1]}
                </motion.h1>
              </AnimatePresence>
            </div>
          </FadeUp>
        </div>

        <FadeUp
          delay={0.1}
          className="flex shrink-0 items-center justify-center pb-6 lg:pb-0 lg:pr-6 xl:pr-20"
        >
          <motion.video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-dog-poster.jpg"
            className="h-56 w-auto object-contain sm:h-64 lg:h-full lg:max-w-[280px] xl:max-w-[340px]"
            aria-label="Illustrated dog mascot that follows your cursor"
            style={
              reduceMotion
                ? undefined
                : { x: dogX, y: dogY, rotate: dogRotate }
            }
          >
            <source src="/hero-dog.webm" type="video/webm" />
            <source src="/hero-dog.mp4" type="video/mp4" />
          </motion.video>
        </FadeUp>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-20">
          <FadeUp delay={0.06}>
            <div className="flex flex-col items-start gap-2">
              <Button
                size="lg"
                onClick={() =>
                  user ? router.push("/dashboard") : openAuth("sign-up")
                }
              >
                {user ? "Go to Dashboard" : "Get Started"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Free during early access
              </span>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="max-w-xl">
              <p className="text-lg font-bold text-foreground">
                Just ask Rudolf.
              </p>
              <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground md:text-base">
                Articles, videos, podcasts, papers. Save everything in one
                place, and Rudolf brings it back the moment you ask.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
