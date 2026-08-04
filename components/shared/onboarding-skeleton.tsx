import { Skeleton } from "@/components/ui/skeleton";

export function OnboardingSkeleton() {
    return (
        <div className="w-full space-y-6">
            <div className="mb-8 space-y-3">
                <Skeleton className="mx-auto h-4 w-24" />
                <div className="flex gap-1">
                    <Skeleton className="h-1 flex-1 rounded-full" />
                    <Skeleton className="h-1 flex-1 rounded-full" />
                    <Skeleton className="h-1 flex-1 rounded-full" />
                    <Skeleton className="h-1 flex-1 rounded-full" />
                </div>
            </div>

            <div className="w-full space-y-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-full max-w-md" />
                    <Skeleton className="h-4 w-72" />
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="size-24 rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4">
                <div />
                <Skeleton className="h-9 w-28" />
            </div>
        </div>
    );
}
