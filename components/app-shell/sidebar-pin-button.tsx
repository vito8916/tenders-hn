"use client";

import { Pin, PinOff } from "lucide-react";

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function SidebarPinButton() {
	const { open, setOpen, setHoverOpen, isMobile } = useSidebar();

	if (isMobile) return null;

	return (
		<SidebarMenu className="group-data-[collapsible=icon]:hidden">
			<SidebarMenuItem>
				<SidebarMenuButton
					onClick={() => {
						setOpen(!open);
						// Unpinning under the pointer keeps the sidebar open until it leaves.
						if (open) setHoverOpen(true);
					}}
				>
					{open ? <PinOff /> : <Pin />}
					<span>{open ? "Desfijar barra lateral" : "Fijar barra lateral"}</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
