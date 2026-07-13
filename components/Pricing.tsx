"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useAuth } from "@/components/AuthContext";

const included = [
  "Unlimited saves from anywhere",
  "Personalized recommendations",
  "AI-powered knowledge library",
  "Conversational retrieval",
  "Smart summaries with source references",
  "Early access to every new feature",
];

export default function Pricing() {
  const { user, openAuth } = useAuth();
  const router = useRouter();

  return (
    <section
      id="pricing"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          <FadeUp delay={0.06}>
            <div>
              <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
                Become a
                <br />
                Founding
                <br />
                Member.
              </h2>
              <p className="mt-6 text-2xl font-medium tracking-[-0.02em] text-muted-foreground">
                Early access · free to join
              </p>
              <p className="mt-6 max-w-sm text-[17px] leading-[1.65] text-muted-foreground">
                Create your account, start saving, and help shape the future
                of personal knowledge management before public launch.
              </p>
              <div className="mt-10">
                <Button
                  size="lg"
                  onClick={() =>
                    user ? router.push("/dashboard") : openAuth("sign-up")
                  }
                >
                  {user ? "Go to Dashboard" : "Get Started"}
                </Button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <ul className="divide-y divide-border border-t border-border">
              {included.map((item) => (
                <li
                  key={item}
                  className="py-5 text-[17px] text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
