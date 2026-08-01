import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ProjectDetailsHeaderSkeleton() {
    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>
            <Skeleton className="h-9 w-40" />
        </div>
    );
}

function ProjectDetailsOverviewSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProjectDetailsMetaSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-px w-full" />
                <div className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function ProjectDetailsSkeleton() {
    return (
        <>
            <ProjectDetailsHeaderSkeleton />
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <ProjectDetailsOverviewSkeleton />
                <ProjectDetailsMetaSkeleton />
            </div>
        </>
    );
}
