import { format, formatDistanceToNow } from "date-fns";
import { ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	SettingsSection,
	SettingsSectionBody,
} from "@/components/settings/settings-section";
import type { AuditLogEntry } from "@/features/events/services";
import { eventDetail, eventLabel } from "@/features/events/utils";

export function AuditLogList({ events }: { events: AuditLogEntry[] }) {
	return (
		<SettingsSection
			title="Recent activity"
			description="Events recorded for this organization, newest first."
		>
			<SettingsSectionBody className="py-0">
				{events.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-muted">
							<ScrollText className="size-4 text-muted-foreground" />
						</div>
						<p className="text-sm font-medium">No activity yet</p>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							Events appear here when members create projects, send
							invitations, or update organization settings.
						</p>
					</div>
				) : (
					<div className="divide-y divide-border/60">
						{events.map((event) => {
							const detail = eventDetail(event);

							return (
								<article
									key={event.id}
									className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
								>
									<div className="min-w-0 space-y-1.5">
										<div className="flex flex-wrap items-center gap-2">
											<Badge
												variant="outline"
												className="font-mono text-[10px] uppercase"
											>
												{event.eventName}
											</Badge>
											<span className="text-sm font-medium">
												{eventLabel(event.eventName)}
											</span>
										</div>
										<p className="text-sm text-muted-foreground">
											<span className="text-foreground">{event.actorName}</span>
											{detail ? (
												<>
													{" "}
													· <span>{detail}</span>
												</>
											) : null}
										</p>
									</div>
									<div className="shrink-0 text-right text-xs text-muted-foreground">
										<p>{format(event.createdAt, "MMM d, yyyy · h:mm a")}</p>
										<p className="mt-0.5">
											{formatDistanceToNow(event.createdAt, { addSuffix: true })}
										</p>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</SettingsSectionBody>
		</SettingsSection>
	);
}
