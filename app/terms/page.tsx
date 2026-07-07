import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service - Layrrrd.",
  description: "The terms that govern your use of Layrrrd.",
};

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <main className="pt-[72px]">
        <div className="mx-auto max-w-[680px] px-6 py-[80px] md:px-10 md:py-[120px]">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-6 mb-12 text-[2.5rem] font-bold leading-[1.0] tracking-[-0.03em] text-foreground md:text-[3.25rem]">
            Terms of Service
          </h1>
          <div className="space-y-8 text-[17px] leading-[1.7] text-muted-foreground">
            <p>
              By joining the Layrrrd waitlist or using Layrrrd, you agree to
              these terms. Layrrrd is provided to help you organize and
              revisit content you save; you are responsible for the content
              you submit.
            </p>
            <p>
              Layrrrd is billed monthly at the price shown on our pricing
              page at the time of signup. You may cancel at any time; access
              continues through the end of the billing period already paid
              for.
            </p>
            <p>
              We may update these terms as the product evolves. Continued use
              of Layrrrd after changes take effect constitutes acceptance of
              the updated terms.
            </p>
            <p>
              Questions about these terms can be sent to{" "}
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
