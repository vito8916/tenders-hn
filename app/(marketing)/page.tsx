import HeroSection from "@/components/marketing/hero-section";
import Pricing from "@/components/marketing/pricing";
import Features1 from "@/components/marketing/features1";
import Features from "@/components/marketing/features";


// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;


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
