"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NavUser } from "@/components/app-shell/nav-user";
import { SidebarPinButton } from "@/components/app-shell/sidebar-pin-button";
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
			<SidebarHeader className="flex h-14 shrink-0 flex-row items-center border-b border-sidebar-border px-2 py-0">
				<SidebarMenuButton asChild tooltip="Volver al inicio" className="size-8">
					<Link
						href={`/organizations/${orgSlug}`}
						aria-label="Volver al inicio"
					>
						<ArrowLeft className="size-4" />
					</Link>
				</SidebarMenuButton>
				<h2 className="flex-1 truncate text-center text-sm font-medium group-data-[collapsible=icon]:hidden">Configuración</h2>
				<div className="size-8 shrink-0 group-data-[collapsible=icon]:hidden" aria-hidden />
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
											<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
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
				<SidebarPinButton />
				<NavUser profile={profile} />
			</SidebarFooter>
		</>
	);
}
