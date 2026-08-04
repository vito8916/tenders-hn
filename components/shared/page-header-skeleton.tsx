import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton({
    showAction = false,
    actionWidth = "w-32",
}: {
    showAction?: boolean;
    actionWidth?: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-7 w-36" />
                    <Skeleton className="h-4 w-56" />
                </div>
            </div>
            {showAction ? <Skeleton className={`h-9 ${actionWidth}`} /> : null}
        </div>
    );
}
