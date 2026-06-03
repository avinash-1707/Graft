import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { IdeaSection } from "@/components/landing/IdeaSection";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <IdeaSection />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
