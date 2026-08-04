import { OrganizationsListSkeleton } from "@/components/shared/organizations-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationsLoading() {
    return (
        <div className="w-full max-w-2xl flex flex-col items-center">
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="mb-8 h-4 w-72" />
            <div className="mb-6 flex w-full items-center gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-40" />
            </div>
            <OrganizationsListSkeleton />
        </div>
    );
}
