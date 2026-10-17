"use client"

import Link from "next/link"
import {useParams, usePathname} from "next/navigation"

import {
    ChevronRight,
    History,
    Home,
    Settings,
    Users,
    type LucideIcon,
} from "lucide-react"
import {cn} from "@/lib/utils"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"

interface MenuItem {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    // Also active on the pages under these paths, e.g. Inicio on a list's page.
    activeUnder?: string[];
    items?: MenuItem[];
}

export function NavMain() {
    const pathname = usePathname()
    const params = useParams();
    const orgSlug = params.orgSlug
    const settingsPathPrefix = `/organizations/${orgSlug}/settings`

    const items: MenuItem[] = [
        {
            title: "Inicio",
            url: `/organizations/${orgSlug}`,
            icon: Home,
            activeUnder: ["opportunities", "lists"].map((segment) => `/organizations/${orgSlug}/${segment}`),
        },
        {
            title: "Historial",
            url: `/organizations/${orgSlug}/updates`,
            icon: History,
            activeUnder: [`/organizations/${orgSlug}/updates`],
        },
        {
            title: "Miembros",
            url: `/organizations/${orgSlug}/members`,
            icon: Users,
        },
        {
            title: "Configuración",
            url: `${settingsPathPrefix}/account`,
            icon: Settings,
        },
    ]

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Menú</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const isActive = item.url.startsWith(settingsPathPrefix)
                        ? pathname.startsWith(settingsPathPrefix)
                        : pathname === item.url ||
                          (item.activeUnder?.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ?? false);

                    return item.items ? (
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.items.some((subitem) => pathname === subitem.url)}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon/>}
                                        <span>{item.title}</span>
                                        <ChevronRight
                                            className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"/>
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items?.map((subItem) => (
                                            <SidebarMenuSubItem key={subItem.title}>
                                                <SidebarMenuSubButton asChild>
                                                    <Link prefetch href={subItem.url}
                                                          className={cn(pathname === subItem.url && "bg-sidebar-accent text-sidebar-accent-foreground")}>
                                                        <span>{subItem.title}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isActive}>
                                <Link prefetch href={item.url}>
                                    {item.icon && <item.icon/>}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
