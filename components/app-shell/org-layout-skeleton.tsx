import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import type { ReactNode } from "react";

export function OrgLayoutSkeleton({ children }: { children: ReactNode }) {
    return (
        <SidebarProvider>
            <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
                <div className="flex h-full flex-col gap-4 p-4">
                    <Skeleton className="h-10 w-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-4/5" />
                        <Skeleton className="h-8 w-3/5" />
                    </div>
                </div>
            </aside>
            <SidebarInset className="bg-background overflow-x-hidden">
                <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border">
                    <div className="flex items-center gap-2 px-6">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
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
