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
			title="Integrations"
			description="API keys and webhooks for connecting external services."
		>
			<SettingsTemplateNotice description="Store API keys hashed in Supabase and sign webhook payloads before enabling these actions." />

			<SettingsTemplateSection
				title="API keys"
				description="Create keys for server-to-server access scoped to this organization."
			>
				<div className="mb-4 flex justify-end">
					<Button size="sm" disabled>
						<Plus className="size-4" />
						Create key
					</Button>
				</div>
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-10 text-center">
					<p className="text-sm font-medium">No API keys</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Generate a key to authenticate requests from your backend or CI.
					</p>
				</div>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Webhooks"
				description="Receive HTTP callbacks when events happen in your organization."
			>
				<SettingsRow
					label="Endpoint URL"
					description="We will POST signed payloads to this URL."
				>
					<div className="flex w-full max-w-sm gap-2 sm:w-auto">
						<Input
							placeholder="https://api.example.com/webhooks"
							disabled
							className="font-mono text-xs"
						/>
						<Button variant="outline" size="icon" disabled>
							<Copy className="size-4" />
						</Button>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Signing secret"
					description="Verify webhook authenticity with this secret."
				>
					<Badge variant="outline" className="font-mono text-xs">
						whsec_••••••••
					</Badge>
				</SettingsRow>
				<div className="flex justify-end pt-2">
					<Button size="sm" disabled>
						Save webhook
					</Button>
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
