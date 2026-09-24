import CtaSection from "@/components/marketing/cta-section";
import ExamplesSection from "@/components/marketing/examples-section";
import FaqSection from "@/components/marketing/faq-section";
import FeaturesSection from "@/components/marketing/features-section";
import HeroSection from "@/components/marketing/hero-section";
import HowItWorksSection from "@/components/marketing/how-it-works-section";
import PricingSection from "@/components/marketing/pricing-section";
import WhySection from "@/components/marketing/why-section";

export default function Home() {
	return (
		<>
			<HeroSection />
			<FeaturesSection />
			<HowItWorksSection />
			<WhySection />
			<ExamplesSection />
			<PricingSection />
			<FaqSection />
			<CtaSection />
		</>
	);
}
