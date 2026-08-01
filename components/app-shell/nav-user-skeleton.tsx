import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";

export default function NavUserSkeleton() {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2">
					<Skeleton className="relative size-10 shrink-0 overflow-hidden rounded-full" />
					<div className="grid flex-1 text-left text-sm leading-tight gap-1">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-full" />
					</div>
				</div>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
