import { Skeleton } from "@/components/ui/skeleton";

function SettingsPanelSkeleton({
	fields = 3,
	showFooter = true,
}: {
	fields?: number;
	showFooter?: boolean;
}) {
	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs">
			<div className="space-y-2 border-b border-border/60 px-6 py-5">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-56" />
			</div>
			<div className="space-y-4 px-6 py-6">
				{Array.from({ length: fields }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-9 w-full" />
					</div>
				))}
			</div>
			{showFooter ? (
				<div className="flex justify-end border-t border-border/60 bg-muted/20 px-6 py-4">
					<Skeleton className="h-9 w-20" />
				</div>
			) : null}
		</div>
	);
}

export function SettingsFormSkeleton({
	sections = 2,
}: {
	sections?: number;
}) {
	return (
		<div className="space-y-6">
			{Array.from({ length: sections }).map((_, index) => (
				<SettingsPanelSkeleton
					key={index}
					fields={index === 0 ? 3 : 2}
					showFooter={index !== sections - 1 || sections < 3}
				/>
			))}
		</div>
	);
}
