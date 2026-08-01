import HeroSection from "@/components/marketing/hero-section";
import Pricing from "@/components/marketing/pricing";
import Features1 from "@/components/marketing/features1";
import Features from "@/components/marketing/features";


export default function Home() {
	return (
		<>
			<HeroSection />
			<Features1 />
			<Features />
			<Pricing />
		</>
	);
}
