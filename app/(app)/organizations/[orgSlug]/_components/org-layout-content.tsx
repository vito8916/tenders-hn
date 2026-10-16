import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { getOrganizationBySlugService, listOrganizationsByUserService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrgProvider } from "@/contexts/org-context";
import { HeaderNotifications, HeaderNotificationsFallback } from "@/features/notifications/components/header-notifications";
import { requireOnboarding } from "@/lib/auth/require-onboarding";
import { Suspense, type ReactNode } from "react";
import { OrgHeader } from "@/components/app-shell/org-header";
import { PlanGate } from "@/features/billing/components/plan-gate";
import { PlanGateBoundary } from "@/features/billing/components/plan-gate-boundary";
import { hasActivePlanService } from "@/features/billing/services";

export async function OrgLayoutContent({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    const { user, profile } = await requireOnboarding();
    const { orgSlug } = await params;

    const [organization, organizations, cookieStore] = await Promise.all([
        getOrganizationBySlugService(orgSlug),
        listOrganizationsByUserService({ userId: user.sub }),
        cookies(),
    ]);
    const isSidebarPinned = cookieStore.get("sidebar_state")?.value === "true";

    if (!organization) {
        redirect("/organizations");
    }

    const [role, hasActivePlan] = await Promise.all([
        getUserOrgRoleService({ userId: user.sub, orgId: organization.id }),
        hasActivePlanService(organization.id),
    ]);

    if (!role) {
        redirect("/organizations");
    }

    const planGate = hasActivePlan ? null : <PlanGate orgId={organization.id} orgSlug={orgSlug} role={role} />;

    return (
        <OrgProvider org={organization} organizations={organizations}>
            <SidebarProvider defaultOpen={isSidebarPinned}>
                <AppSidebar profile={profile} />
                <SidebarInset className="bg-background overflow-x-hidden">
                    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border">
                        <div className="flex items-center gap-2 px-6">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <OrgHeader />
                        </div>
                        <div className="flex items-center gap-2 px-6">
                            <ThemeSwitcher />
                            <Suspense fallback={<HeaderNotificationsFallback />}>
                                <HeaderNotifications userId={user.sub} />
                            </Suspense>
                        </div>
                    </header>
                    <PlanGateBoundary gate={planGate}>{children}</PlanGateBoundary>
                </SidebarInset>
            </SidebarProvider>
        </OrgProvider>
    );
}
