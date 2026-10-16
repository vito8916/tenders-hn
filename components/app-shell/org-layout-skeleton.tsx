import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import type { ReactNode } from "react";

export function OrgLayoutSkeleton({ children }: { children: ReactNode }) {
    return (
        <SidebarProvider>
            <aside className="hidden w-(--sidebar-width-icon) shrink-0 flex-col items-center gap-4 border-r bg-sidebar py-3 md:flex">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-1 flex-col items-center gap-3 pt-4">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton key={index} className="size-5 rounded-sm" />
                    ))}
                </div>
                <Skeleton className="size-8 rounded-lg" />
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
