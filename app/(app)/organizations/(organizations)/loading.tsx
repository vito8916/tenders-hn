import { OrganizationsListSkeleton } from "@/components/shared/organizations-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationsLoading() {
    return (
        <div className="flex w-full max-w-2xl flex-col items-center">
            <Skeleton className="mb-2 h-8 w-40" />
            <Skeleton className="mb-8 h-4 w-80 max-w-full" />
            <div className="mb-6 flex w-full items-center gap-4">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-40" />
            </div>
            <OrganizationsListSkeleton />
        </div>
    );
}
