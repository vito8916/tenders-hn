import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shared/page-header-skeleton";

function OverviewCardsSkeleton({ cards = 3 }: { cards?: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cards }).map((_, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="size-4 rounded-sm" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-3 w-36" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function RecentActivitySkeleton() {
    return (
        <Card>
            <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-3.5 w-52" />
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <li key={index} className="flex items-baseline justify-between gap-4">
                            <Skeleton className="h-4 w-48 sm:w-64" />
                            <Skeleton className="h-3 w-20 shrink-0" />
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

/** Dashboard overview: header + stat cards + recent activity. */
export function PageSectionSkeleton({
    cards = 3,
    showHeader = false,
    showAction = true,
}: {
    cards?: number;
    showHeader?: boolean;
    showAction?: boolean;
}) {
    return (
        <div className="space-y-6">
            {showHeader ? (
                <PageHeaderSkeleton showAction={showAction} actionWidth="w-32" />
            ) : null}
            {cards > 0 ? <OverviewCardsSkeleton cards={cards} /> : null}
            <RecentActivitySkeleton />
        </div>
    );
}
