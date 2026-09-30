import {
	Bell,
	BriefcaseBusiness,
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
				label: "Cuenta",
				icon: User,
				description: "Perfil, contraseña y apariencia.",
			},
			{
				segment: "notifications",
				label: "Notificaciones",
				icon: Bell,
				description: "Avisos por correo electrónico y en la aplicación.",
			},
			{
				segment: "security",
				label: "Seguridad",
				icon: Shield,
				description: "Sesiones y verificación en dos pasos.",
			},
		],
	},
	{
		label: "Organización",
		items: [
			{
				segment: "organization",
				label: "General",
				icon: Building2,
				description: "Nombre, identificador en la URL, logo y zona de riesgo.",
			},
			{
				segment: "company",
				label: "Perfil de la empresa",
				icon: BriefcaseBusiness,
				description: "Lo que vende la empresa, exclusiones y departamentos.",
			},
			{
				segment: "billing",
				label: "Facturación",
				icon: CreditCard,
				description: "Plan, uso y facturas.",
			},
			{
				segment: "integrations",
				label: "Integraciones",
				icon: KeyRound,
				description: "Claves de API y webhooks.",
			},
			{
				segment: "audit-log",
				label: "Registro de actividad",
				icon: ScrollText,
				description: "Cambios y actividad de la organización.",
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
