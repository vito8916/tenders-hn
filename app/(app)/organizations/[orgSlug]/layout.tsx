import { Suspense } from "react";
import type { ReactNode } from "react";
import { OrgLayoutSkeleton } from "@/components/app-shell/org-layout-skeleton";
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";
import { OrgLayoutContent } from "./_components/org-layout-content";

function OrgLayoutFallback() {
    return (
        <OrgLayoutSkeleton>
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                <PageSectionSkeleton cards={3} showHeader showAction />
            </div>
        </OrgLayoutSkeleton>
    );
}

export default function DashboardLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <Suspense fallback={<OrgLayoutFallback />}>
            <OrgLayoutContent params={params}>{children}</OrgLayoutContent>
        </Suspense>
    );
}
