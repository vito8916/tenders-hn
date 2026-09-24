import { cn } from "@/lib/utils";

export function SectionHeading({
	eyebrow,
	title,
	description,
	align = "center",
	className,
}: {
	eyebrow: string;
	title: string;
	description?: string;
	align?: "center" | "start";
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex max-w-2xl flex-col gap-3",
				align === "center" && "mx-auto items-center text-center",
				className,
			)}
		>
			<p className="font-mono text-xs font-medium tracking-wider text-accent-blue uppercase">
				{eyebrow}
			</p>
			<h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
				{title}
			</h2>
			{description && (
				<p className="text-base text-pretty text-muted-foreground md:text-lg">
					{description}
				</p>
			)}
		</div>
	);
}
