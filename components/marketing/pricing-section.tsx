import { Check } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/billing/components/format-money";
import { planFeatures } from "@/features/billing/schemas";
import { getPublicPlansService } from "@/features/billing/services";
import { cn } from "@/lib/utils";

const FEATURED_PLAN_ID = "estandar";

export default async function PricingSection() {
	const plans = await getPublicPlansService();

	return (
		<section id="planes" className="scroll-mt-14 border-t py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Planes"
					title="Sin costos sorpresa"
					description="El matching y los reportes van incluidos en todos los planes. Los créditos de IA solo se usan en el chat y en análisis que usted pida."
				/>

				<ul className="mx-auto mt-14 grid max-w-5xl gap-3 md:grid-cols-3 md:grid-rows-[auto_1fr]">
					{plans.map((plan) => {
						const featured = plan.planId === FEATURED_PLAN_ID;
						// The plan survives sign-up and email verification in `next`, and preselects the onboarding plan step.
						const signUpHref = `/sign-up?next=${encodeURIComponent(`/onboarding?plan=${plan.planId}`)}`;
						return (
							<li
								key={plan.planId}
								className={cn(
									"flex flex-col rounded-2xl p-2 md:row-span-2 md:grid md:grid-rows-subgrid",
									featured ? "bg-foreground text-background" : "bg-background shadow-edge",
								)}
							>
								<div className="flex flex-col gap-1.5 px-4 pt-4 pb-6">
									<div className="flex items-center justify-between gap-2">
										<h3 className="font-semibold tracking-tight">{plan.name}</h3>
										{featured && (
											<span className="rounded-full bg-background/15 px-2 py-0.5 text-[11px] font-medium">
												Recomendado
											</span>
										)}
									</div>
									<p className={cn("text-sm text-pretty", featured ? "text-background/70" : "text-muted-foreground")}>
										{plan.description}
									</p>
									<p className="mt-auto pt-4 text-xl font-semibold tracking-tight">
										{plan.price ? formatMoney(plan.price.amount, plan.price.currencyCode) : "—"}
										<span className={cn("text-sm font-normal", featured ? "text-background/70" : "text-muted-foreground")}>
											{" "}
											al mes
										</span>
									</p>
								</div>

								<div
									className={cn(
										"flex flex-1 flex-col gap-6 rounded-lg p-4",
										featured ? "bg-background/10" : "bg-muted/50",
									)}
								>
									<ul className="flex flex-col gap-2.5">
										{planFeatures(plan).map((feature) => (
											<li key={feature} className="flex items-center gap-2 text-sm">
												<Check
													className={cn("size-4 shrink-0", featured ? "text-background/70" : "text-accent-blue")}
													strokeWidth={1.5}
												/>
												{feature}
											</li>
										))}
									</ul>
									<Button
										asChild
										variant={featured ? "secondary" : "ghost"}
										className={cn(
											"mt-auto w-full transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]",
											!featured && "bg-background shadow-edge",
										)}
									>
										<Link href={signUpHref}>Elegir {plan.name}</Link>
									</Button>
								</div>
							</li>
						);
					})}
				</ul>

				<p className="mt-8 text-center text-xs text-muted-foreground">
					Precios mensuales en dólares, con impuestos incluidos. Si tiene un código de piloto, ingréselo al pagar.
				</p>
			</div>
		</section>
	);
}
