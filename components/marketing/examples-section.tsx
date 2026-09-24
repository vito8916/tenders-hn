import { RelevanceBadge } from "@/components/marketing/relevance-badge";
import { SectionHeading } from "@/components/marketing/section-heading";

// Each profile is paired with a real process from the 22 Sep 2026 capture.
const examples = [
	{
		business: "Vendemos soporte y licencias de software empresarial.",
		code: "LPN-008-2026",
		entity: "Instituto Hondureño de Seguridad Social",
		title: "Adquisición de soporte funcional SAP",
		closes: "10 nov 2026",
	},
	{
		business: "Distribuimos equipo y reactivos para laboratorio clínico.",
		code: "HN-SESAL-569324-GO-RFB",
		entity: "Secretaría de Salud",
		title: "Equipo médico para tres laboratorios de biología molecular",
		closes: "29 oct 2026",
	},
	{
		business: "Construimos y rehabilitamos carreteras con concreto hidráulico.",
		code: "LPN-SIT-051-2026",
		entity: "Secretaría de Infraestructura y Transporte",
		title: "Pavimentación con concreto hidráulico 4000 PSI, tramo Patuca - Nueva Choluteca",
		closes: "16 oct 2026",
	},
	{
		business: "Confeccionamos uniformes y equipo de protección personal.",
		code: "UNAH-SEAF-LPN-009-2026",
		entity: "Universidad Nacional Autónoma de Honduras",
		title: "Uniformes e indumentaria de protección para el personal de servicio",
		closes: "3 nov 2026",
	},
];

export default function ExamplesSection() {
	return (
		<section className="overflow-hidden border-t bg-muted/30 py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Ejemplos reales"
					title="Así se ve una coincidencia para su tipo de negocio"
					description="Perfiles de ejemplo junto a procesos publicados en HonduCompras el 22 de septiembre de 2026."
				/>

				<ul className="-mx-4 mt-14 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
					{examples.map((example) => (
						<li
							key={example.code}
							className="flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-background p-2 shadow-edge lg:w-auto"
						>
							<blockquote className="px-4 pt-4 pb-6 text-sm text-pretty">«{example.business}»</blockquote>
							<div className="mt-auto flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3.5">
								<RelevanceBadge relevance="high" />
								<p className="text-sm font-medium text-pretty">{example.title}</p>
								<p className="text-xs text-pretty text-muted-foreground">{example.entity}</p>
								<div className="flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
									<span className="truncate font-mono">{example.code}</span>
									<span className="shrink-0 tabular-nums">Cierra {example.closes}</span>
								</div>
							</div>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
