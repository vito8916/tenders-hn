import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import type { ReactNode } from "react";

function SidebarNavItemSkeleton({ width = "w-28" }: { width?: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className={`h-4 ${width}`} />
        </div>
    );
}

export function OrgLayoutSkeleton({ children }: { children: ReactNode }) {
    return (
        <SidebarProvider>
            <aside className="hidden w-(--sidebar-width) shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
                <div className="flex flex-col gap-2 p-2">
                    <div className="flex items-center gap-2 rounded-md p-2">
                        <Skeleton className="size-8 shrink-0 rounded-lg" />
                        <div className="grid flex-1 gap-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="size-4 shrink-0 rounded-sm" />
                    </div>
                </div>

                <div className="flex flex-1 flex-col gap-6 overflow-hidden px-2 py-2">
                    <div className="space-y-1">
                        <Skeleton className="mb-2 ml-2 h-3 w-16" />
                        <SidebarNavItemSkeleton width="w-24" />
                        <SidebarNavItemSkeleton width="w-20" />
                        <SidebarNavItemSkeleton width="w-24" />
                        <SidebarNavItemSkeleton width="w-20" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="mb-2 ml-2 h-3 w-20" />
                        <SidebarNavItemSkeleton width="w-32" />
                        <SidebarNavItemSkeleton width="w-28" />
                    </div>
                </div>

                <div className="p-2">
                    <div className="flex items-center gap-2 rounded-md p-2">
                        <Skeleton className="size-8 shrink-0 rounded-lg" />
                        <div className="grid flex-1 gap-1.5">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="size-4 shrink-0 rounded-sm" />
                    </div>
                </div>
            </aside>

            <SidebarInset className="overflow-x-hidden bg-background">
                <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border">
                    <div className="flex items-center gap-2 px-6">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <Skeleton className="h-8 w-40" />
                    </div>
                    <div className="flex items-center gap-2 px-4">
                        <ThemeSwitcher />
                        <Skeleton className="size-9 rounded-md" />
                    </div>
                </header>
                {children}
            </SidebarInset>
        </SidebarProvider>
    );
}
