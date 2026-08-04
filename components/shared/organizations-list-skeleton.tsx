import { Skeleton } from "@/components/ui/skeleton";

export function OrganizationsListSkeleton() {
    return (
        <div className="w-full space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
        </div>
    );
}
