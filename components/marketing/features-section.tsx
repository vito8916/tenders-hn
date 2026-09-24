import { Check, FileText, ScanText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { RelevanceBadge } from "@/components/marketing/relevance-badge";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

const stats = [
	{ value: "12", unit: "páginas", label: "de resultados en HonduCompras para solo dos días de publicaciones" },
	{ value: "30", unit: "procesos", label: "por página, que alguien tendría que abrir uno por uno" },
	{ value: "3", unit: "niveles", label: "muy relevante, posible o descartada, siempre con su motivo" },
	{ value: "0", unit: "créditos", label: "para el matching y el reporte base: van incluidos en el plan" },
];

export default function FeaturesSection() {
	return (
		<section id="funciones" className="scroll-mt-14 py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Funciones"
					title="Menos tiempo buscando, más tiempo preparando ofertas"
					description="Hacemos la parte repetitiva de revisar HonduCompras para que su equipo solo lea lo que vale la pena."
				/>

				<div className="mt-14 grid gap-3 lg:grid-cols-12">
					<FeatureCard
						className="lg:col-span-6"
						title="Una lista corta, no cientos de páginas"
						description="Cada búsqueda termina en pocas oportunidades ordenadas por relevancia, con fecha de cierre y enlace a la fuente oficial."
					>
						<ShortlistVisual />
					</FeatureCard>
					<FeatureCard
						className="lg:col-span-6"
						title="Motivos que usted puede verificar"
						description="Le mostramos qué parte del proceso coincide con lo que vende. Ninguna razón se presenta sin comprobarla contra el texto original."
					>
						<EvidenceVisual />
					</FeatureCard>
					<FeatureCard
						className="lg:col-span-7"
						title="Lee pliegos y anexos, incluso escaneados"
						description="Muchas coincidencias solo aparecen dentro de los documentos. Extraemos su texto y aplicamos OCR cuando el PDF es una imagen."
					>
						<DocumentsVisual />
					</FeatureCard>
					<FeatureCard
						className="lg:col-span-5"
						title="Pregúntele al pliego"
						description="Consulte plazos y requisitos en un chat que cita el documento del que sale cada respuesta."
					>
						<ChatVisual />
					</FeatureCard>
				</div>

				<dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
					{stats.map((stat) => (
						<div key={stat.unit} className="flex flex-col gap-2 border-t pt-5">
							<dt className="order-2 text-sm text-pretty text-muted-foreground">{stat.label}</dt>
							<dd className="order-1 flex items-baseline gap-1.5">
								<span className="text-4xl font-semibold tracking-tight tabular-nums">{stat.value}</span>
								<span className="text-sm font-medium text-muted-foreground">{stat.unit}</span>
							</dd>
						</div>
					))}
				</dl>
				<p className="mt-6 text-xs text-muted-foreground">
					Búsqueda por fecha de inicio del 22 al 23 de septiembre de 2026 en HonduCompras.
				</p>
			</div>
		</section>
	);
}

function FeatureCard({
	title,
	description,
	className,
	children,
}: {
	title: string;
	description: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<article className={cn("flex flex-col rounded-2xl bg-muted/50 p-2 shadow-edge", className)}>
			<div className="px-4 pt-4 pb-5">
				<h3 className="font-semibold tracking-tight">{title}</h3>
				<p className="mt-1.5 text-sm text-pretty text-muted-foreground">{description}</p>
			</div>
			<div aria-hidden className="relative mt-auto h-52 overflow-hidden rounded-lg bg-background shadow-edge select-none">
				{children}
			</div>
		</article>
	);
}

function ShortlistVisual() {
	return (
		<div className="flex h-full items-center gap-4 px-4 sm:px-6">
			<div className="flex flex-col items-center gap-1">
				<span className="text-3xl font-semibold tracking-tight tabular-nums">360</span>
				<span className="text-[11px] text-muted-foreground">procesos</span>
			</div>
			<div className="hidden h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--border)_0_4px,transparent_4px_8px)] sm:block" />
			<ul className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-56 sm:flex-none">
				{[
					{ code: "LPN-008-2026", relevance: "high" as const },
					{ code: "CD-035-2026", relevance: "high" as const },
					{ code: "LP-002-AHAC-2026", relevance: "possible" as const },
				].map((item) => (
					<li key={item.code} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 shadow-edge">
						<span className="truncate font-mono text-[11px]">{item.code}</span>
						<RelevanceBadge relevance={item.relevance} />
					</li>
				))}
			</ul>
		</div>
	);
}

function EvidenceVisual() {
	return (
		<div className="flex h-full flex-col justify-center gap-3 px-6">
			<div className="flex items-center justify-between gap-2">
				<span className="font-mono text-[11px] text-muted-foreground">LPN-008-2026 · IHSS</span>
				<RelevanceBadge relevance="high" />
			</div>
			<p className="text-sm leading-relaxed text-muted-foreground">
				IHSS-GTIC-Adquisición de{" "}
				<mark className="rounded-sm bg-accent-blue/15 px-0.5 text-foreground">soporte funcional SAP</mark>{" "}
				para el Instituto Hondureño de Seguridad Social
			</p>
			<div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2.5 text-xs">
				<Check className="mt-px size-3.5 shrink-0 text-accent-blue" />
				<span>
					Su perfil menciona <span className="font-medium">soporte SAP</span>. Coincide con el objeto del proceso y con el pliego.
				</span>
			</div>
		</div>
	);
}

function DocumentsVisual() {
	const documents = [
		{ name: "Aviso de prensa.pdf", status: "Texto extraído", icon: FileText },
		{ name: "Pliego o términos de referencia.pdf", status: "Texto extraído", icon: FileText },
		{ name: "Anexos al pliego.pdf", status: "OCR aplicado", icon: ScanText },
	];

	return (
		<ul className="flex h-full flex-col justify-center gap-2 px-6">
			{documents.map((document) => (
				<li key={document.name} className="flex items-center gap-3 rounded-md px-3 py-2.5 shadow-edge">
					<document.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
					<span className="min-w-0 flex-1 truncate text-xs font-medium">{document.name}</span>
					<span
						className={cn(
							"shrink-0 text-[11px]",
							document.status === "OCR aplicado" ? "text-accent-blue" : "text-muted-foreground",
						)}
					>
						{document.status}
					</span>
				</li>
			))}
		</ul>
	);
}

function ChatVisual() {
	return (
		<div className="flex h-full flex-col justify-center gap-3 px-5">
			<p className="ms-auto max-w-[85%] rounded-lg rounded-br-sm bg-foreground px-3 py-2 text-xs text-background">
				¿Hasta cuándo se reciben ofertas?
			</p>
			<div className="flex max-w-[92%] items-start gap-2">
				<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
					<Sparkles className="size-3" />
				</span>
				<div className="flex flex-col gap-2 rounded-lg rounded-tl-sm bg-muted/60 px-3 py-2 text-xs">
					<p>
						La fecha de cierre es el <span className="font-medium">10 de noviembre de 2026</span>.
					</p>
					<span className="inline-flex w-fit items-center gap-1 rounded-sm bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-edge">
						<FileText className="size-2.5" />
						Detalle del proceso
					</span>
				</div>
			</div>
		</div>
	);
}
