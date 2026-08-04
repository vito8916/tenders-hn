import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppEvent } from "../schemas";
import { eventDetail, eventLabel } from "../utils";

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
								<li
									key={event.id}
									className="flex items-baseline justify-between gap-4 text-sm"
								>
									<span>
										{eventLabel(event.eventName)}
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
