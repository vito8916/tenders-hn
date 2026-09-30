"use client";

import { Copy, Plus } from "lucide-react";

import { SettingsRow } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	SettingsTemplateNotice,
	SettingsTemplatePage,
	SettingsTemplateSection,
} from "@/features/settings/components/settings-template-shell";

export function IntegrationsSettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Integraciones"
			description="Claves de API y webhooks para conectar servicios externos."
		>
			<SettingsTemplateNotice description="Las claves de API y los webhooks aún no están disponibles. Los datos que ve son de ejemplo." />

			<SettingsTemplateSection
				title="Claves de API"
				description="Cree claves para que sus sistemas accedan a los datos de esta organización."
			>
				<div className="mb-4 flex justify-end">
					<Button size="sm" disabled>
						<Plus className="size-4" />
						Crear clave
					</Button>
				</div>
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-10 text-center">
					<p className="text-sm font-medium">No hay claves de API</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Genere una clave para autenticar las solicitudes de sus sistemas.
					</p>
				</div>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Webhooks"
				description="Reciba avisos HTTP cuando ocurran eventos en su organización."
			>
				<SettingsRow
					label="URL de destino"
					description="Enviaremos solicitudes firmadas a esta URL."
				>
					<div className="flex w-full max-w-sm gap-2 sm:w-auto">
						<Input
							placeholder="https://api.ejemplo.com/webhooks"
							disabled
							className="font-mono text-xs"
						/>
						<Button variant="outline" size="icon" disabled aria-label="Copiar">
							<Copy className="size-4" />
						</Button>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Secreto de firma"
					description="Use este secreto para verificar que los webhooks son auténticos."
				>
					<Badge variant="outline" className="font-mono text-xs">
						whsec_••••••••
					</Badge>
				</SettingsRow>
				<div className="flex justify-end pt-2">
					<Button size="sm" disabled>
						Guardar webhook
					</Button>
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
