import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
    title,
    description,
    icon: Icon,
    action,
}: {
    title: string;
    description: ReactNode;
    icon: LucideIcon;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <Icon className="size-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">{title}</h1>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
