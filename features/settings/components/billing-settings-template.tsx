"use client";

import { SettingsRow } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	SettingsTemplateNotice,
	SettingsTemplatePage,
	SettingsTemplateSection,
} from "@/features/settings/components/settings-template-shell";

const usageMetrics = [
	{ label: "Miembros", used: 4, limit: 10 },
	{ label: "Proyectos", used: 12, limit: 25 },
	{ label: "Almacenamiento", used: "1.2 GB", limit: "5 GB" },
];

export function BillingSettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Facturación"
			description="Administre el plan, el uso y las facturas de su organización."
		>
			<SettingsTemplateNotice description="La facturación aún no está disponible. Los datos que ve son de ejemplo." />

			<SettingsTemplateSection
				title="Plan actual"
				description="Su organización está en período de prueba."
			>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<p className="text-lg font-semibold tracking-tight">Pro</p>
							<Badge variant="secondary">Prueba</Badge>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							US$19 al mes · Se renueva el 3 de septiembre de 2026
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" disabled>
							Cambiar plan
						</Button>
						<Button size="sm" disabled>
							Mejorar plan
						</Button>
					</div>
				</div>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Uso"
				description="Consumo de recursos en este período de facturación."
			>
				{usageMetrics.map((metric) => (
					<SettingsRow
						key={metric.label}
						label={metric.label}
						description={`Usado: ${metric.used} de ${metric.limit}`}
					>
						<span className="font-mono text-sm text-muted-foreground">
							{metric.used} / {metric.limit}
						</span>
					</SettingsRow>
				))}
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Facturas"
				description="Descargue sus facturas anteriores."
			>
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-10 text-center">
					<p className="text-sm font-medium">Aún no hay facturas</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Las facturas aparecerán aquí cuando la facturación esté disponible.
					</p>
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
