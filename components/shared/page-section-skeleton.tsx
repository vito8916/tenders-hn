import { Skeleton } from "@/components/ui/skeleton";

export function PageSectionSkeleton({ cards = 3 }: { cards?: number }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: cards }).map((_, index) => (
                    <Skeleton key={index} className="h-28 w-full rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
}
