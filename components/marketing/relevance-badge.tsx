import { cn } from "@/lib/utils";

export type Relevance = "high" | "possible" | "discarded";

const relevanceStyles: Record<Relevance, { label: string; className: string }> = {
	high: {
		label: "Muy relevante",
		className: "bg-accent-blue/10 text-accent-blue",
	},
	possible: {
		label: "Posible",
		className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	},
	discarded: {
		label: "Descartada",
		className: "bg-muted text-muted-foreground",
	},
};

export function RelevanceBadge({
	relevance,
	className,
}: {
	relevance: Relevance;
	className?: string;
}) {
	const { label, className: toneClassName } = relevanceStyles[relevance];

	return (
		<span
			className={cn(
				"inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-[11px] font-medium whitespace-nowrap",
				toneClassName,
				className,
			)}
		>
			<span className="size-1.5 rounded-full bg-current" aria-hidden />
			{label}
		</span>
	);
}
