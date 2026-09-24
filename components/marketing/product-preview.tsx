import { FileText, Play, Plus, Search } from "lucide-react";

import { RelevanceBadge, type Relevance } from "@/components/marketing/relevance-badge";
import { cn } from "@/lib/utils";

// Real processes published on HonduCompras on 22 Sep 2026, ranked for a
// company that sells software support and licenses.
const opportunities: {
	relevance: Relevance;
	code: string;
	title: string;
	entity: string;
	closes: string;
	documents: number;
}[] = [
	{
		relevance: "high",
		code: "LPN-008-2026",
		title: "Adquisición de soporte funcional SAP",
		entity: "IHSS",
		closes: "10 nov",
		documents: 3,
	},
	{
		relevance: "high",
		code: "CD-035-2026",
		title: "Suscripción de mantenimiento de software médico",
		entity: "IHSS",
		closes: "15 oct",
		documents: 2,
	},
	{
		relevance: "possible",
		code: "LP-002-AHAC-2026",
		title: "Alquiler de equipo para computación",
		entity: "AHAC",
		closes: "14 oct",
		documents: 1,
	},
	{
		relevance: "discarded",
		code: "LPN-SDE-003-2026",
		title: "Adquisición de vehículo automotor tipo camioneta",
		entity: "SDE",
		closes: "3 nov",
		documents: 0,
	},
];

const savedSearches = [
	{ name: "Soporte de software", newMatches: 2, active: true },
	{ name: "Equipos de cómputo", newMatches: 1, active: false },
	{ name: "Licencias", newMatches: 0, active: false },
];

export function ProductPreview() {
	return (
		<div
			aria-hidden
			className="rounded-2xl bg-muted/60 p-2 shadow-edge select-none"
		>
			<div className="grid overflow-hidden rounded-lg bg-background shadow-edge md:grid-cols-[13rem_1fr]">
				<PreviewSidebar />
				<div className="min-w-0">
					<PreviewHeader />
					<ul className="divide-y">
						{opportunities.map((opportunity) => (
							<li
								key={opportunity.code}
								className={cn(
									"flex items-center gap-3 px-4 py-3 text-left",
									opportunity.relevance === "discarded" && "opacity-50",
								)}
							>
								<div className="w-28 shrink-0">
									<RelevanceBadge relevance={opportunity.relevance} />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{opportunity.title}</p>
									<p className="truncate font-mono text-[11px] text-muted-foreground">
										{opportunity.code}
									</p>
								</div>
								<span className="hidden w-12 text-xs text-muted-foreground sm:block">
									{opportunity.entity}
								</span>
								<span className="hidden w-14 text-xs text-muted-foreground tabular-nums lg:block">
									{opportunity.closes}
								</span>
								<span className="hidden w-8 items-center gap-1 text-xs text-muted-foreground tabular-nums lg:flex">
									<FileText className="size-3" strokeWidth={1.5} />
									{opportunity.documents}
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

function PreviewSidebar() {
	return (
		<div className="hidden border-r bg-muted/30 p-3 text-left md:block">
			<p className="px-2 pb-3 text-xs font-medium">Soluciones TI</p>
			<div className="mb-3 flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2 text-xs font-medium text-background">
				<Plus className="size-3.5" />
				Nueva búsqueda
			</div>
			<p className="px-2 pb-1.5 text-[11px] text-muted-foreground">Búsquedas</p>
			<ul className="flex flex-col gap-0.5">
				{savedSearches.map((search) => (
					<li
						key={search.name}
						className={cn(
							"flex h-7 items-center gap-2 rounded-md px-2 text-xs",
							search.active ? "bg-background font-medium shadow-edge" : "text-muted-foreground",
						)}
					>
						<Search className="size-3" strokeWidth={1.5} />
						<span className="flex-1 truncate">{search.name}</span>
						{search.newMatches > 0 && (
							<span className="rounded-sm bg-accent-blue/10 px-1 text-[10px] font-medium text-accent-blue tabular-nums">
								{search.newMatches}
							</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

function PreviewHeader() {
	return (
		<div className="flex items-center justify-between gap-4 border-b px-4 py-3 text-left">
			<div className="min-w-0">
				<p className="truncate text-sm font-semibold">Soporte de software</p>
				<p className="truncate text-[11px] text-muted-foreground">
					<span className="tabular-nums">23 sep 2026, 07:00</span> · 360 procesos evaluados · 3 para revisar
				</p>
			</div>
			<div className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium shadow-edge">
				<Play className="size-3 fill-current" />
				Ejecutar ahora
			</div>
		</div>
	);
}
