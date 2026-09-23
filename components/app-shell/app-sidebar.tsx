"use client";

import { ComponentProps } from "react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/app-shell/nav-main";
import { NavUser } from "@/components/app-shell/nav-user";
import { SettingsSidebar } from "@/components/app-shell/settings-sidebar";
import { TeamSwitcher } from "@/components/app-shell/team-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useOrgContext } from "@/contexts/org-context";
import { Profile } from "@/features/profiles/schemas";

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
	profile: Profile;
}

export function AppSidebar({ profile, ...props }: AppSidebarProps) {
	const pathname = usePathname();
	const isSettings = pathname.includes("/settings");
	const { organizations } = useOrgContext();

	return (
		<Sidebar collapsible="icon" {...props}>
			{isSettings ? (
				<SettingsSidebar profile={profile} />
			) : (
				<>
					<SidebarHeader>
						<TeamSwitcher organizations={organizations} />
					</SidebarHeader>
					<SidebarContent>
						<NavMain />
					</SidebarContent>
					<SidebarFooter>
						<NavUser profile={profile} />
					</SidebarFooter>
				</>
			)}
			<SidebarRail />
		</Sidebar>
	);
}
