import {
	Bell,
	Building2,
	CreditCard,
	KeyRound,
	ScrollText,
	Shield,
	User,
	type LucideIcon,
} from "lucide-react";

export type SettingsNavItem = {
	segment: string;
	label: string;
	icon: LucideIcon;
	description: string;
};

export type SettingsNavGroup = {
	label: string;
	items: SettingsNavItem[];
};

export const settingsNavGroups: SettingsNavGroup[] = [
	{
		label: "Personal",
		items: [
			{
				segment: "account",
				label: "Account",
				icon: User,
				description: "Profile, password, and appearance.",
			},
			{
				segment: "notifications",
				label: "Notifications",
				icon: Bell,
				description: "Email and in-app notification preferences.",
			},
			{
				segment: "security",
				label: "Security",
				icon: Shield,
				description: "Sessions, two-factor authentication, and access.",
			},
		],
	},
	{
		label: "Organization",
		items: [
			{
				segment: "organization",
				label: "General",
				icon: Building2,
				description: "Name, slug, logo, and danger zone.",
			},
			{
				segment: "billing",
				label: "Billing",
				icon: CreditCard,
				description: "Plan, usage, and invoices.",
			},
			{
				segment: "integrations",
				label: "Integrations",
				icon: KeyRound,
				description: "API keys and webhooks.",
			},
			{
				segment: "audit-log",
				label: "Audit log",
				icon: ScrollText,
				description: "Organization activity from app_events.",
			},
		],
	},
];

export function settingsPath(orgSlug: string, segment: string) {
	return `/organizations/${orgSlug}/settings/${segment}`;
}

export function isSettingsPathActive(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`);
}
