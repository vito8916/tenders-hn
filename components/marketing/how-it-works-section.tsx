import { Check, Mail } from "lucide-react";
import type { ReactNode } from "react";

import { RelevanceBadge } from "@/components/marketing/relevance-badge";
import { SectionHeading } from "@/components/marketing/section-heading";

export default function HowItWorksSection() {
	return (
		<section id="como-funciona" className="scroll-mt-14 border-t bg-muted/30 py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Cómo funciona"
					title="Tres pasos y su equipo deja de revisar a mano"
					description="Lo configura una vez. Después, los reportes llegan solos con la frecuencia que usted elija."
				/>

				<ol className="mt-14 grid gap-3 md:grid-cols-3">
					<Step
						number={1}
						title="Describa lo que vende"
						description="Con sus propias palabras. Agregue ejemplos y lo que no le interesa recibir; los códigos UNSPSC son opcionales."
					>
						<div className="flex h-full flex-col justify-center gap-3 px-4">
							<p className="rounded-md px-3 py-2.5 text-xs leading-relaxed shadow-edge">
								Soporte de software empresarial, licencias SAP y desarrollo de integraciones
								<span className="ms-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-foreground" />
							</p>
							<div className="flex flex-wrap gap-1.5">
								<span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
									Excluir: vehículos
								</span>
								<span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
									Excluir: obra civil
								</span>
							</div>
						</div>
					</Step>

					<Step
						number={2}
						title="Guarde sus búsquedas"
						description="Una por línea de negocio, cada una con su frecuencia y forma de entrega."
					>
						<div className="flex h-full flex-col justify-center gap-2 px-4">
							{[
								{ name: "Soporte de software", schedule: "Diaria, 7:00" },
								{ name: "Equipos de cómputo", schedule: "Lunes, 7:00" },
							].map((search) => (
								<div key={search.name} className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 shadow-edge">
									<span className="truncate text-xs font-medium">{search.name}</span>
									<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{search.schedule}</span>
								</div>
							))}
							<div className="flex gap-3 px-1 pt-1 text-[11px] text-muted-foreground">
								{["Correo", "PDF", "CSV"].map((channel) => (
									<span key={channel} className="flex items-center gap-1">
										<Check className="size-3 text-accent-blue" />
										{channel}
									</span>
								))}
							</div>
						</div>
					</Step>

					<Step
						number={3}
						title="Revise la lista corta"
						description="Marque lo que le interesa y descarte lo que no. Esa señal nos ayuda a mejorar sus próximos reportes."
					>
						<div className="flex h-full flex-col justify-center px-4">
							<div className="rounded-md shadow-edge">
								<div className="flex items-center gap-2 border-b px-3 py-2">
									<Mail className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
									<span className="truncate text-xs font-medium">3 oportunidades para Soporte de software</span>
								</div>
								<div className="flex flex-col gap-1.5 px-3 py-2.5">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-mono text-[11px]">LPN-008-2026</span>
										<RelevanceBadge relevance="high" />
									</div>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-mono text-[11px]">CD-035-2026</span>
										<RelevanceBadge relevance="high" />
									</div>
								</div>
							</div>
						</div>
					</Step>
				</ol>
			</div>
		</section>
	);
}

function Step({
	number,
	title,
	description,
	children,
}: {
	number: number;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<li className="flex flex-col rounded-2xl bg-background p-2 shadow-edge">
			<div className="px-4 pt-4 pb-5">
				<span className="font-mono text-xs font-medium text-accent-blue tabular-nums">Paso {number}</span>
				<h3 className="mt-2 font-semibold tracking-tight">{title}</h3>
				<p className="mt-1.5 text-sm text-pretty text-muted-foreground">{description}</p>
			</div>
			<div aria-hidden className="mt-auto h-40 overflow-hidden rounded-lg bg-muted/40 shadow-edge select-none">
				{children}
			</div>
		</li>
	);
}
