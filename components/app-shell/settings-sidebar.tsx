"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NavUser } from "@/components/app-shell/nav-user";
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	isSettingsPathActive,
	settingsNavGroups,
	settingsPath,
} from "@/features/settings/config/settings-nav";
import { Profile } from "@/features/profiles/schemas";

export function SettingsSidebar({ profile }: { profile: Profile }) {
	const pathname = usePathname();
	const params = useParams();
	const orgSlug = params.orgSlug as string;

	return (
		<>
			<SidebarHeader className="flex flex-row items-center border-b border-sidebar-border px-2">
				<SidebarMenuButton asChild tooltip="Back to dashboard" className="size-8">
					<Link
						href={`/organizations/${orgSlug}`}
						aria-label="Back to dashboard"
					>
						<ArrowLeft className="size-4" />
					</Link>
				</SidebarMenuButton>
				<h2 className="flex-1 text-center text-sm font-medium">Settings</h2>
				<div className="size-8 shrink-0" aria-hidden />
			</SidebarHeader>

			<SidebarContent>
				{settingsNavGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => {
									const href = settingsPath(orgSlug, item.segment);
									const isActive = isSettingsPathActive(pathname, href);

									return (
										<SidebarMenuItem key={item.segment}>
											<SidebarMenuButton asChild isActive={isActive}>
												<Link prefetch href={href}>
													<item.icon className="size-4" />
													<span>{item.label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<NavUser profile={profile} />
			</SidebarFooter>
		</>
	);
}
