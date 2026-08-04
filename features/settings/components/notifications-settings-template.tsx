"use client";

import { SettingsRow } from "@/components/settings/settings-section";
import { Switch } from "@/components/ui/switch";
import {
	SettingsTemplateNotice,
	SettingsTemplatePage,
	SettingsTemplateSection,
} from "@/features/settings/components/settings-template-shell";

const notificationPreferences = [
	{
		id: "invitations",
		label: "Team invitations",
		description: "When someone is invited or accepts an invitation.",
		defaultChecked: true,
	},
	{
		id: "project-updates",
		label: "Project updates",
		description: "Status changes and new projects in your organization.",
		defaultChecked: true,
	},
	{
		id: "mentions",
		label: "Mentions",
		description: "When you are mentioned in comments or activity.",
		defaultChecked: true,
	},
	{
		id: "weekly-digest",
		label: "Weekly digest",
		description: "A summary of activity across your organization.",
		defaultChecked: false,
	},
	{
		id: "marketing",
		label: "Product updates",
		description: "News about features and template improvements.",
		defaultChecked: false,
	},
];

export function NotificationsSettingsTemplate() {
	return (
		<SettingsTemplatePage
			title="Notifications"
			description="Choose what you want to be notified about. Preferences are stored per user."
		>
			<SettingsTemplateNotice />

			<SettingsTemplateSection
				title="Email notifications"
				description="Control which emails are sent to your account address."
			>
				{notificationPreferences.map((pref) => (
					<SettingsRow
						key={pref.id}
						label={pref.label}
						description={pref.description}
					>
						<Switch defaultChecked={pref.defaultChecked} disabled />
					</SettingsRow>
				))}
			</SettingsTemplateSection>

			<SettingsTemplateSection
				title="In-app notifications"
				description="Show alerts inside the app when you are signed in."
			>
				<SettingsRow
					label="Desktop notifications"
					description="Browser notifications for time-sensitive events."
				>
					<Switch disabled />
				</SettingsRow>
				<SettingsRow
					label="Sound"
					description="Play a sound when a new notification arrives."
				>
					<Switch disabled />
				</SettingsRow>
			</SettingsTemplateSection>
		</SettingsTemplatePage>
	);
}
