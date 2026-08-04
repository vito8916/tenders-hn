import { OrgLayoutSkeleton } from "@/components/app-shell/org-layout-skeleton";
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";

export default function OrgLoading() {
    return (
        <OrgLayoutSkeleton>
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg border bg-background" />
                        <div className="space-y-2">
                            <div className="h-7 w-40 rounded-md bg-muted" />
                            <div className="h-4 w-56 rounded-md bg-muted" />
                        </div>
                    </div>
                </div>
                <PageSectionSkeleton />
            </div>
        </OrgLayoutSkeleton>
    );
}
