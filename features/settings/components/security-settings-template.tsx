"use client";

import { Laptop, Smartphone } from "lucide-react";

import { SettingsRow } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	SettingsTemplateNotice,
	SettingsTemplatePage,
	SettingsTemplateSection,
} from "@/features/settings/components/settings-template-shell";

const mockSessions = [
	{
		id: "1",
		device: "MacBook Pro",
		location: "Tegucigalpa, HN",
		lastActive: "Activo ahora",
		current: true,
		icon: Laptop,
	},
	{
		id: "2",
		device: "iPhone 15",
		location: "Tegucigalpa, HN",
		lastActive: "Hace 2 días",
		current: false,
		icon: Smartphone,
	},
];

export function SecuritySettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Seguridad"
			description="Administre el acceso, las sesiones activas y la protección de su cuenta."
		>
			<SettingsTemplateNotice />

			<SettingsTemplateSection
				title="Verificación en dos pasos"
				description="Agregue una capa extra de seguridad a su cuenta."
			>
				<SettingsRow
					label="Aplicación de autenticación"
					description="Use una aplicación como 1Password o Google Authenticator."
				>
					<Button variant="outline" size="sm" disabled>
						Activar
					</Button>
				</SettingsRow>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Sesiones activas"
				description="Dispositivos con sesión iniciada en su cuenta."
			>
				<div className="divide-y divide-border/60">
					{mockSessions.map((session) => (
						<div
							key={session.id}
							className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="flex items-start gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
									<session.icon className="size-4 text-muted-foreground" />
								</div>
								<div>
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">{session.device}</p>
										{session.current ? (
											<Badge variant="secondary" className="text-[10px]">
												Actual
											</Badge>
										) : null}
									</div>
									<p className="text-sm text-muted-foreground">
										{session.location} · {session.lastActive}
									</p>
								</div>
							</div>
							{!session.current ? (
								<Button variant="outline" size="sm" disabled>
									Revocar
								</Button>
							) : null}
						</div>
					))}
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
