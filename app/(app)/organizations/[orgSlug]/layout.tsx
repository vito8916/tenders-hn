import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { getOrganizationBySlugService, listOrganizationsByUserService } from "@/features/organizations/services";
import { listFavoriteProjectsService } from "@/features/projects/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { redirect } from "next/navigation";
import { OrgProvider } from "@/contexts/org-context";
import { Button } from "@/components/ui/button";
import { Bell } from 'lucide-react';
import { requireOnboarding } from "@/lib/auth/require-onboarding";
import type { ReactNode } from "react";
import ProjectSwitcher from "@/components/app-shell/project-switcher";

export default async function DashboardLayout({children, params,}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    const { user, profile } = await requireOnboarding();

    const { orgSlug } = await params;
    const [organization, organizations] = await Promise.all([
        getOrganizationBySlugService(orgSlug),
        listOrganizationsByUserService({ userId: user.sub }),
    ]);

    if (!organization) {
        redirect("/organizations");
    }

    const [role, favoriteProjects] = await Promise.all([
        getUserOrgRoleService({ userId: user.sub, orgId: organization.id }),
        listFavoriteProjectsService({ userId: user.sub, orgId: organization.id }),
    ]);

    if (!role) {
        redirect("/organizations");
    }

    return (
        <OrgProvider org={organization} organizations={organizations} favoriteProjects={favoriteProjects}>
            <SidebarProvider>
                <AppSidebar profile={profile} />
                <SidebarInset className="bg-background overflow-x-hidden">
                    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2 px-6">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <ProjectSwitcher />
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeSwitcher />
                            <Button variant="ghost" size="icon" className="shrink-0">
                                <Bell className="size-5" />
                            </Button>
                        </div>
                    </header>
                    {children}
                </SidebarInset>
            </SidebarProvider>
        </OrgProvider>
    );
}
