import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy - Layrrrd.",
  description: "How Layrrrd collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="pt-[72px]">
        <div className="mx-auto max-w-[680px] px-6 py-[80px] md:px-10 md:py-[120px]">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-6 mb-12 text-[2.5rem] font-bold leading-[1.0] tracking-[-0.03em] text-foreground md:text-[3.25rem]">
            Privacy Policy
          </h1>
          <div className="space-y-8 text-[17px] leading-[1.7] text-muted-foreground">
            <p>
              Layrrrd (&quot;we&quot;, &quot;us&quot;) respects your privacy.
              This policy explains what information we collect when you join
              our waitlist or use our product, and how we use it.
            </p>
            <p>
              We collect the email address you provide when joining the
              waitlist, along with the content you choose to save through
              Layrrrd once you have access. We use this information solely to
              operate the product, send you your curated reading list, and
              communicate updates about Layrrrd.
            </p>
            <p>
              We do not sell your data to third parties. We may share data
              with service providers who help us operate Layrrrd (such as
              email or hosting providers), under obligations to keep it
              confidential.
            </p>
            <p>
              You can request deletion of your data at any time by emailing{" "}
              <a
                href="mailto:layrrrd@gmail.com"
                className="text-foreground underline underline-offset-4"
              >
                layrrrd@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
