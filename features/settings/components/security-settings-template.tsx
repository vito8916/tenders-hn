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
		location: "San Francisco, US",
		lastActive: "Active now",
		current: true,
		icon: Laptop,
	},
	{
		id: "2",
		device: "iPhone 15",
		location: "San Francisco, US",
		lastActive: "2 days ago",
		current: false,
		icon: Smartphone,
	},
];

export function SecuritySettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Security"
			description="Manage authentication, active sessions, and account protection."
		>
			<SettingsTemplateNotice />

			<SettingsTemplateSection
				title="Two-factor authentication"
				description="Add an extra layer of security to your account."
			>
				<SettingsRow
					label="Authenticator app"
					description="Use an app like 1Password or Google Authenticator."
				>
					<Button variant="outline" size="sm" disabled>
						Enable
					</Button>
				</SettingsRow>
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="Active sessions"
				description="Devices currently signed in to your account."
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
												Current
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
									Revoke
								</Button>
							) : null}
						</div>
					))}
				</div>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
