import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppEvent } from "../schemas";

const EVENT_LABELS: Record<string, string> = {
    "organization.created": "Organization created",
    "organization.updated": "Organization settings updated",
    "organization.ownership_transferred": "Ownership transferred",
    "invitation.sent": "Invitations sent",
    "invitation.accepted": "Invitation accepted",
    "invitation.revoked": "Invitation revoked",
    "member.role_changed": "Member role changed",
    "member.removed": "Member removed",
    "member.left": "Member left",
    "project.created": "Project created",
    "project.deleted": "Project deleted",
};

function eventDetail(event: AppEvent): string | null {
    const metadata = event.metadata;
    if (!metadata) return null;

    if (typeof metadata.name === "string") return metadata.name;
    if (typeof metadata.email === "string") return metadata.email;
    if (Array.isArray(metadata.emails)) return metadata.emails.join(", ");
    if (typeof metadata.from === "string" && typeof metadata.to === "string") {
        return `${metadata.from} to ${metadata.to}`;
    }
    return null;
}

export function RecentActivity({ events }: { events: AppEvent[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4" />
                    Recent activity
                </CardTitle>
                <CardDescription>Latest events in this organization.</CardDescription>
            </CardHeader>
            <CardContent>
                {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {events.map((event) => {
                            const detail = eventDetail(event);
                            return (
                                <li key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
                                    <span>
                                        {EVENT_LABELS[event.eventName] ?? event.eventName}
                                        {detail ? (
                                            <span className="text-muted-foreground"> — {detail}</span>
                                        ) : null}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
