import { BellOff, FileSpreadsheet, FileText, History, LayoutList, Mail, MessageSquareText, ScanSearch, ShieldCheck } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";

const strengths = [
	{
		icon: ShieldCheck,
		title: "Cada motivo tiene evidencia",
		description: "Ninguna razón ni cita se muestra sin verificarla contra el texto del proceso o de sus documentos.",
	},
	{
		icon: ScanSearch,
		title: "Preferimos no perder oportunidades",
		description: "Cuando hay duda, el proceso queda como «posible» para que usted decida. No lo ocultamos.",
	},
	{
		icon: BellOff,
		title: "Sin avisos repetidos",
		description: "Una oportunidad vuelve a su correo solo si cambia algo importante: fecha, etapa o documentos.",
	},
	{
		icon: History,
		title: "Claros con la fuente",
		description: "Siempre verá cuándo se consultó HonduCompras por última vez y si un análisis quedó parcial.",
	},
];

const deliveryChannels = [
	{ icon: Mail, label: "Correo" },
	{ icon: FileText, label: "Reporte PDF" },
	{ icon: FileSpreadsheet, label: "CSV para Excel" },
	{ icon: LayoutList, label: "Bandeja en la plataforma" },
	{ icon: MessageSquareText, label: "Chat con fuentes" },
];

export default function WhySection() {
	return (
		<section className="border-t py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Por qué Tenders HN"
					title="Hecho para confiar en lo que le mostramos"
					description="Le ayudamos a descubrir y priorizar. La decisión de ofertar, y la lectura de las bases oficiales, siguen siendo suyas."
				/>

				<ul className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
					{strengths.map((strength) => (
						<li key={strength.title} className="flex flex-col gap-3">
							<span className="flex size-9 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
								<strength.icon className="size-4.5" />
							</span>
							<h3 className="font-semibold tracking-tight">{strength.title}</h3>
							<p className="text-sm text-pretty text-muted-foreground">{strength.description}</p>
						</li>
					))}
				</ul>

				<div className="mt-20 flex flex-col items-center gap-8 border-t pt-14">
					<p className="text-center text-sm text-muted-foreground">
						Los resultados llegan a donde ya trabaja
					</p>
					<ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
						{deliveryChannels.map((channel) => (
							<li key={channel.label} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<channel.icon className="size-4" strokeWidth={1.5} />
								{channel.label}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
