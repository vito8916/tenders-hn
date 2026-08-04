import { Skeleton } from "@/components/ui/skeleton";

export function OrganizationsListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="flex w-full flex-col gap-3">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border bg-card p-4"
                >
                    <div className="flex items-center gap-4">
                        <Skeleton className="size-10 shrink-0 rounded-md" />
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3.5 w-48" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Skeleton className="size-4 rounded-sm" />
                            <Skeleton className="h-3.5 w-4" />
                        </div>
                        <Skeleton className="size-5 rounded-sm" />
                    </div>
                </div>
            ))}
        </div>
    );
}
