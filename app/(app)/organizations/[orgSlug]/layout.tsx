import { Suspense } from "react";
import type { ReactNode } from "react";
import { OrgLayoutSkeleton } from "@/components/app-shell/org-layout-skeleton";
import { OrgLayoutContent } from "./_components/org-layout-content";

export default function DashboardLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <Suspense fallback={<OrgLayoutSkeleton>{children}</OrgLayoutSkeleton>}>
            <OrgLayoutContent params={params}>{children}</OrgLayoutContent>
        </Suspense>
    );
}
