"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SettingsRow } from "@/components/settings/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsTemplateSection } from "@/features/settings/components/settings-template-shell";
import { updateNotificationPreferenceAction } from "../actions";
import type { NotificationPreference } from "../schemas";

const CATEGORY_SECTIONS = [
	{
		category: "organization",
		title: "Organizations",
		description: "Membership, role, and invitation activity.",
	},
	{
		category: "billing",
		title: "Billing",
		description: "Plan changes for organizations you own or administer.",
	},
] as const;

type Channel = "inApp" | "email";

export function NotificationPreferencesForm({
	preferences,
}: {
	preferences: NotificationPreference[];
}) {
	const [current, setCurrent] = useState(preferences);

	const setChannel = (typeId: string, channel: Channel, enabled: boolean) =>
		setCurrent((prev) =>
			prev.map((pref) => (pref.typeId === typeId ? { ...pref, [channel]: enabled } : pref)),
		);

	const toggle = async (pref: NotificationPreference, channel: Channel, enabled: boolean) => {
		setChannel(pref.typeId, channel, enabled);

		const result = await updateNotificationPreferenceAction({
			typeId: pref.typeId,
			inApp: channel === "inApp" ? enabled : pref.inApp,
			email: channel === "email" ? enabled : pref.email,
		});

		if (!result.success) {
			setChannel(pref.typeId, channel, !enabled);
			toast.error(result.error ?? "Could not save your preference");
		}
	};

	return CATEGORY_SECTIONS.map((section) => (
		<SettingsTemplateSection
			key={section.category}
			title={section.title}
			description={section.description}
		>
			{current
				.filter((pref) => pref.category === section.category)
				.map((pref) => (
					<SettingsRow key={pref.typeId} label={pref.label} description={pref.description}>
						<div className="flex items-center gap-6">
							<ChannelSwitch
								id={`${pref.typeId}-in-app`}
								label="In-app"
								checked={pref.inApp}
								onCheckedChange={(enabled) => toggle(pref, "inApp", enabled)}
							/>
							<ChannelSwitch
								id={`${pref.typeId}-email`}
								label="Email"
								checked={pref.email}
								onCheckedChange={(enabled) => toggle(pref, "email", enabled)}
							/>
						</div>
					</SettingsRow>
				))}
		</SettingsTemplateSection>
	));
}

function ChannelSwitch({
	id,
	label,
	checked,
	onCheckedChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
			<Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
				{label}
			</Label>
		</div>
	);
}
