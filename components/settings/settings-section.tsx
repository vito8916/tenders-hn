import { cn } from "@/lib/utils";

interface SettingsSectionProps {
	title: string;
	description?: string;
	children: React.ReactNode;
	variant?: "default" | "danger";
	className?: string;
}

export function SettingsSection({
	title,
	description,
	children,
	variant = "default",
	className,
}: SettingsSectionProps) {
	return (
		<section
			className={cn(
				"overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs",
				variant === "danger" && "border-destructive/30",
				className
			)}
		>
			<header
				className={cn(
					"border-b border-border/60 px-6 py-5",
					variant === "danger" && "border-destructive/20"
				)}
			>
				<h2
					className={cn(
						"text-sm font-medium tracking-tight",
						variant === "danger" && "text-destructive"
					)}
				>
					{title}
				</h2>
				{description ? (
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				) : null}
			</header>
			{children}
		</section>
	);
}

export function SettingsSectionBody({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={cn("px-6 py-6", className)}>{children}</div>;
}

export function SettingsSectionFooter({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-end gap-3 border-t border-border/60 bg-muted/20 px-6 py-4",
				className
			)}
		>
			{children}
		</div>
	);
}

export function SettingsRow({
	label,
	description,
	children,
	className,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 border-b border-border/60 py-5 last:border-b-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between",
				className
			)}
		>
			<div className="min-w-0 sm:max-w-xs">
				<p className="text-sm font-medium">{label}</p>
				{description ? (
					<p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}
