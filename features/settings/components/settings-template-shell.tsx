import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
	SettingsSection,
	SettingsSectionBody,
} from "@/components/settings/settings-section";

interface SettingsTemplateNoticeProps {
	title?: string;
	description?: string;
}

export function SettingsTemplateNotice({
	title = "Template placeholder",
	description = "This section is scaffolded for the template. Wire it to Supabase when you are ready to persist settings.",
}: SettingsTemplateNoticeProps) {
	return (
		<div className="mb-6 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline" className="font-mono text-[10px] uppercase">
					Template
				</Badge>
				<p className="text-sm font-medium">{title}</p>
			</div>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

export function SettingsTemplatePage({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			</div>
			{children}
		</div>
	);
}

export function SettingsTemplateSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<SettingsSection title={title} description={description}>
			<SettingsSectionBody>{children}</SettingsSectionBody>
		</SettingsSection>
	);
}
