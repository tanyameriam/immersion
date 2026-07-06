import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import WhyLayrd from "@/components/WhyLayrd";
import WhatsInside from "@/components/WhatsInside";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <WhyLayrd />
        <WhatsInside />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
