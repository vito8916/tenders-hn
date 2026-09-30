import { OrgRoleSchema, ROLE_LABELS } from "@/features/memberships/schemas";
import { APP_EVENTS, type AppEvent } from "./schemas";

export const EVENT_LABELS: Record<string, string> = {
	[APP_EVENTS.ORGANIZATION_CREATED]: "Organización creada",
	[APP_EVENTS.ORGANIZATION_UPDATED]: "Organización actualizada",
	[APP_EVENTS.ORGANIZATION_DELETED]: "Organización eliminada",
	[APP_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFERRED]: "Propiedad transferida",
	[APP_EVENTS.COMPANY_PROFILE_UPDATED]: "Perfil de la empresa actualizado",
	[APP_EVENTS.INVITATION_SENT]: "Invitaciones enviadas",
	[APP_EVENTS.INVITATION_ACCEPTED]: "Invitación aceptada",
	[APP_EVENTS.INVITATION_REVOKED]: "Invitación revocada",
	[APP_EVENTS.MEMBER_ROLE_CHANGED]: "Rol cambiado",
	[APP_EVENTS.MEMBER_REMOVED]: "Miembro quitado",
	[APP_EVENTS.MEMBER_LEFT]: "Miembro salió",
	[APP_EVENTS.SUBSCRIPTION_ACTIVATED]: "Plan activado",
	[APP_EVENTS.SUBSCRIPTION_RENEWED]: "Plan renovado",
	[APP_EVENTS.SUBSCRIPTION_PLAN_CHANGED]: "Plan cambiado",
	[APP_EVENTS.SUBSCRIPTION_CANCELED]: "Plan cancelado",
	[APP_EVENTS.SUBSCRIPTION_EXPIRED]: "Plan vencido",
};

export function eventLabel(eventName: string) {
	return EVENT_LABELS[eventName] ?? eventName;
}

function roleLabel(role: string) {
	const parsed = OrgRoleSchema.safeParse(role);
	return parsed.success ? ROLE_LABELS[parsed.data] : role;
}

export function eventDetail(event: AppEvent): string | null {
	const metadata = event.metadata;
	if (!metadata) return null;

	if (typeof metadata.name === "string") return metadata.name;
	if (typeof metadata.email === "string") return metadata.email;
	if (Array.isArray(metadata.emails)) return metadata.emails.join(", ");
	if (typeof metadata.from === "string" && typeof metadata.to === "string") {
		return `${roleLabel(metadata.from)} → ${roleLabel(metadata.to)}`;
	}
	if (typeof metadata.role === "string") return roleLabel(metadata.role);
	if (typeof metadata.plan_id === "string") return metadata.plan_id;
	if (typeof metadata.slug === "string") return metadata.slug;
	if (typeof metadata.version === "number") return `Versión ${metadata.version}`;

	return null;
}

export function formatActorName(params: {
	fullName: string | null;
	email: string | null;
}) {
	return params.fullName?.trim() || params.email || "Usuario desconocido";
}

export const EVENT_FILTER_GROUPS = [
	{
		label: "Organización",
		events: [
			APP_EVENTS.ORGANIZATION_CREATED,
			APP_EVENTS.ORGANIZATION_UPDATED,
			APP_EVENTS.ORGANIZATION_DELETED,
			APP_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFERRED,
			APP_EVENTS.COMPANY_PROFILE_UPDATED,
		],
	},
	{
		label: "Invitaciones",
		events: [
			APP_EVENTS.INVITATION_SENT,
			APP_EVENTS.INVITATION_ACCEPTED,
			APP_EVENTS.INVITATION_REVOKED,
		],
	},
	{
		label: "Miembros",
		events: [
			APP_EVENTS.MEMBER_ROLE_CHANGED,
			APP_EVENTS.MEMBER_REMOVED,
			APP_EVENTS.MEMBER_LEFT,
		],
	},
	{
		label: "Facturación",
		events: [
			APP_EVENTS.SUBSCRIPTION_ACTIVATED,
			APP_EVENTS.SUBSCRIPTION_RENEWED,
			APP_EVENTS.SUBSCRIPTION_PLAN_CHANGED,
			APP_EVENTS.SUBSCRIPTION_CANCELED,
			APP_EVENTS.SUBSCRIPTION_EXPIRED,
		],
	},
] as const;

export function auditLogHref(
	orgSlug: string,
	query: { page?: number; event?: string | null }
) {
	const params = new URLSearchParams();

	if (query.page && query.page > 1) {
		params.set("page", String(query.page));
	}

	if (query.event) {
		params.set("event", query.event);
	}

	const qs = params.toString();
	return `/organizations/${orgSlug}/settings/audit-log${qs ? `?${qs}` : ""}`;
}
