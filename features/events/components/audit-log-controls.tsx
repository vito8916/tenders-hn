"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AppEventName } from "@/features/events/schemas";
import { auditLogHref, EVENT_FILTER_GROUPS, eventLabel } from "@/features/events/utils";

interface AuditLogControlsProps {
	orgSlug: string;
	page: number;
	totalPages: number;
	total: number;
	pageSize: number;
	eventName: AppEventName | null;
	className?: string;
}

export function AuditLogControls({
	orgSlug,
	page,
	totalPages,
	total,
	pageSize,
	eventName,
	className,
}: AuditLogControlsProps) {
	const router = useRouter();
	const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const rangeEnd = Math.min(page * pageSize, total);
	const prevHref = auditLogHref(orgSlug, { page: page - 1, event: eventName });
	const nextHref = auditLogHref(orgSlug, { page: page + 1, event: eventName });

	return (
		<div
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
				className
			)}
		>
			<Select
				value={eventName ?? "all"}
				onValueChange={(value) => {
					router.push(
						auditLogHref(orgSlug, {
							event: value === "all" ? null : value,
							page: 1,
						})
					);
				}}
			>
				<SelectTrigger size="sm" className="w-full sm:w-[240px]">
					<SelectValue placeholder="All event types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All event types</SelectItem>
					{EVENT_FILTER_GROUPS.map((group) => (
						<SelectGroup key={group.label}>
							<SelectLabel>{group.label}</SelectLabel>
							{group.events.map((event) => (
								<SelectItem key={event} value={event}>
									{eventLabel(event)}
								</SelectItem>
							))}
						</SelectGroup>
					))}
				</SelectContent>
			</Select>

			<div className="flex items-center justify-between gap-3 sm:justify-end">
				<p className="text-sm text-muted-foreground">
					{total === 0
						? "No events"
						: `Showing ${rangeStart}–${rangeEnd} of ${total}`}
				</p>
				<div className="flex items-center gap-1">
					{page > 1 ? (
						<Button asChild variant="outline" size="sm">
							<Link href={prevHref}>
								<ChevronLeft className="size-4" />
								Previous
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							<ChevronLeft className="size-4" />
							Previous
						</Button>
					)}
					<span className="min-w-16 text-center text-sm text-muted-foreground">
						{page} / {totalPages}
					</span>
					{page < totalPages ? (
						<Button asChild variant="outline" size="sm">
							<Link href={nextHref}>
								Next
								<ChevronRight className="size-4" />
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Next
							<ChevronRight className="size-4" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
