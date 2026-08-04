import { APP_EVENTS, type AppEvent } from "./schemas";

export const EVENT_LABELS: Record<string, string> = {
	[APP_EVENTS.ORGANIZATION_CREATED]: "Organization created",
	[APP_EVENTS.ORGANIZATION_UPDATED]: "Organization updated",
	[APP_EVENTS.ORGANIZATION_DELETED]: "Organization deleted",
	[APP_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFERRED]: "Ownership transferred",
	[APP_EVENTS.INVITATION_SENT]: "Invitations sent",
	[APP_EVENTS.INVITATION_ACCEPTED]: "Invitation accepted",
	[APP_EVENTS.INVITATION_REVOKED]: "Invitation revoked",
	[APP_EVENTS.MEMBER_ROLE_CHANGED]: "Member role changed",
	[APP_EVENTS.MEMBER_REMOVED]: "Member removed",
	[APP_EVENTS.MEMBER_LEFT]: "Member left",
	[APP_EVENTS.PROJECT_CREATED]: "Project created",
	[APP_EVENTS.PROJECT_DELETED]: "Project deleted",
	[APP_EVENTS.PROJECT_MEMBER_ASSIGNED]: "Project member assigned",
	[APP_EVENTS.PROJECT_MEMBER_UNASSIGNED]: "Project member unassigned",
};

export function eventLabel(eventName: string) {
	return EVENT_LABELS[eventName] ?? eventName;
}

export function eventDetail(event: AppEvent): string | null {
	const metadata = event.metadata;
	if (!metadata) return null;

	if (typeof metadata.name === "string") return metadata.name;
	if (typeof metadata.email === "string") return metadata.email;
	if (Array.isArray(metadata.emails)) return metadata.emails.join(", ");
	if (typeof metadata.from === "string" && typeof metadata.to === "string") {
		return `${metadata.from} → ${metadata.to}`;
	}
	if (typeof metadata.role === "string") return metadata.role;
	if (typeof metadata.slug === "string") return metadata.slug;

	return null;
}

export function formatActorName(params: {
	fullName: string | null;
	email: string | null;
}) {
	return params.fullName?.trim() || params.email || "Unknown user";
}
