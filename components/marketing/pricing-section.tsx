import { Check } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mirrors the placeholder plans in supabase/seed.sql until pricing is set.
const plans = [
	{
		name: "Básico",
		summary: "Una línea de negocio con reportes diarios.",
		price: "Próximamente",
		featured: false,
		features: ["2 búsquedas activas", "Reportes diarios", "3 miembros", "3 meses de historial", "100 créditos de IA al mes"],
	},
	{
		name: "Piloto",
		summary: "Acceso completo mientras afinamos el producto con usted.",
		price: "Acceso por invitación",
		featured: true,
		features: ["5 búsquedas activas", "Reportes diarios", "5 miembros", "12 meses de historial", "500 créditos de IA al mes"],
	},
	{
		name: "Pro",
		summary: "Varias líneas de negocio, reportes varias veces al día.",
		price: "Próximamente",
		featured: false,
		features: ["10 búsquedas activas", "Reportes cada 6 horas", "10 miembros", "12 meses de historial", "1,000 créditos de IA al mes"],
	},
];

export default function PricingSection() {
	return (
		<section id="planes" className="scroll-mt-14 border-t py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Planes"
					title="Sin costos sorpresa"
					description="El matching y los reportes van incluidos en todos los planes. Los créditos de IA solo se usan en el chat y en análisis que usted pida."
				/>

				<ul className="mx-auto mt-14 grid max-w-5xl gap-3 md:grid-cols-3">
					{plans.map((plan) => (
						<li
							key={plan.name}
							className={cn(
								"flex flex-col rounded-2xl p-2",
								plan.featured ? "bg-foreground text-background" : "bg-background shadow-edge",
							)}
						>
							<div className="flex flex-col gap-1.5 px-4 pt-4 pb-6">
								<div className="flex items-center justify-between gap-2">
									<h3 className="font-semibold tracking-tight">{plan.name}</h3>
									{plan.featured && (
										<span className="rounded-full bg-background/15 px-2 py-0.5 text-[11px] font-medium">
											Disponible ahora
										</span>
									)}
								</div>
								<p className={cn("text-sm text-pretty", plan.featured ? "text-background/70" : "text-muted-foreground")}>
									{plan.summary}
								</p>
								<p className="mt-4 text-xl font-semibold tracking-tight">{plan.price}</p>
							</div>

							<div
								className={cn(
									"flex flex-1 flex-col gap-6 rounded-lg p-4",
									plan.featured ? "bg-background/10" : "bg-muted/50",
								)}
							>
								<ul className="flex flex-col gap-2.5">
									{plan.features.map((feature) => (
										<li key={feature} className="flex items-center gap-2 text-sm">
											<Check
												className={cn("size-4 shrink-0", plan.featured ? "text-background/70" : "text-accent-blue")}
												strokeWidth={1.5}
											/>
											{feature}
										</li>
									))}
								</ul>
								<Button
									asChild
									variant={plan.featured ? "secondary" : "ghost"}
									className={cn(
										"mt-auto w-full transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]",
										!plan.featured && "bg-background shadow-edge",
									)}
								>
									<Link href="/sign-up">{plan.featured ? "Solicitar acceso" : "Crear cuenta"}</Link>
								</Button>
							</div>
						</li>
					))}
				</ul>

				<p className="mt-8 text-center text-xs text-muted-foreground">
					Los precios y límites finales se confirman al terminar el piloto.
				</p>
			</div>
		</section>
	);
}
