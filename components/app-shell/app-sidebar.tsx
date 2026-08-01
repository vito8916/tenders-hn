"use client"

import { ComponentProps } from "react"

import { NavMain } from "@/components/app-shell/nav-main"
import { NavProjects } from "@/components/app-shell/nav-projects"
import { NavUser } from "@/components/app-shell/nav-user"
import { TeamSwitcher } from "@/components/app-shell/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useOrgContext } from "@/contexts/org-context"
import { Profile } from "@/features/profiles/schemas"

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  profile: Profile;
}

/**
 * AppSidebar - Client-side sidebar that uses organization context
 * Displays current organization and allows switching between them
 * Shows user profile in footer
 */
export function AppSidebar({ profile, ...props }: AppSidebarProps) {
  const { organizations } = useOrgContext()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher organizations={organizations} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <NavUser profile={profile} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
