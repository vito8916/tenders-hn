import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export default function NavUserSkeleton() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="ml-auto size-4 shrink-0 rounded-sm" />
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
