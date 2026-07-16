import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TalkToRudolf from "@/components/TalkToRudolf";
import ContentTypes from "@/components/ContentTypes";
import AskRudolf from "@/components/AskRudolf";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <TalkToRudolf />
        <ContentTypes />
        <HowItWorks />
        <AskRudolf />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
