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
	{ label: "Members", used: 4, limit: 10 },
	{ label: "Projects", used: 12, limit: 25 },
	{ label: "Storage", used: "1.2 GB", limit: "5 GB" },
];

export function BillingSettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Billing"
			description="Manage your organization plan, usage, and invoices."
		>
			<SettingsTemplateNotice description="Connect Stripe or your billing provider and persist plan data on the organizations table." />

			<SettingsTemplateSection
				title="Current plan"
				description="Your organization is on the template free tier."
			>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<p className="text-lg font-semibold tracking-tight">Pro</p>
							<Badge variant="secondary">Trial</Badge>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							$19 / month · Renews on Sep 3, 2026
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" disabled>
							Change plan
						</Button>
						<Button size="sm" disabled>
							Upgrade
						</Button>
					</div>
				</div>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Usage"
				description="Resource consumption for this billing period."
			>
				{usageMetrics.map((metric) => (
					<SettingsRow
						key={metric.label}
						label={metric.label}
						description={`${metric.used} of ${metric.limit} used`}
					>
						<span className="font-mono text-sm text-muted-foreground">
							{metric.used} / {metric.limit}
						</span>
					</SettingsRow>
				))}
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Invoices"
				description="Download past invoices for your records."
			>
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-10 text-center">
					<p className="text-sm font-medium">No invoices yet</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Invoices will appear here once billing is connected.
					</p>
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
