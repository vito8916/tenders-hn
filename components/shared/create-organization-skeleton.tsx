import { Skeleton } from "@/components/ui/skeleton";

export function CreateOrganizationSkeleton() {
    return (
        <div className="mx-auto w-full max-w-2xl space-y-6">
            <Skeleton className="h-8 w-56" />

            <div className="space-y-2">
                <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1 rounded-md" />
                    <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
            </div>

            <div className="space-y-6 rounded-xl border p-6">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56" />
                </div>

                <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="size-20 rounded-md" />
                </div>

                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-full" />
                </div>

                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-3 w-48" />
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div />
                <Skeleton className="h-9 w-28" />
            </div>
        </div>
    );
}
