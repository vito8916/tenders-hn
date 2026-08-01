"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Check, ListIcon } from "lucide-react"
import Link from "next/link"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import OrganizationAvatar from "@/features/organizations/components/organization-avatar"
import { useOrg } from "@/contexts/org-context"
import { OrganizationListItem } from "@/features/organizations/schemas"

export function TeamSwitcher({
  organizations,
}: {
  organizations: OrganizationListItem[]
}) {
  const { isMobile } = useSidebar()
  const currentOrg = useOrg()

  if (!currentOrg) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <OrganizationAvatar src={currentOrg.orgLogoUrl} name={currentOrg.name} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentOrg.name}</span>
                <span className="truncate text-xs text-muted-foreground">{currentOrg.slug}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org, index) => (
              <DropdownMenuItem
                key={org.id}
                className="gap-2 p-2 cursor-pointer"
                asChild
              >
                <Link href={`/organizations/${org.slug}`}>
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <OrganizationAvatar className="size-6" src={org.orgLogoUrl} name={org.name} />
                  </div>
                  <span className="flex-1">{org.name}</span>
                  {org.id === currentOrg.id && (
                    <Check className="size-4 text-primary" />
                  )}
                  {index < 9 && (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/organizations">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <ListIcon className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  All Organizations
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/organizations/create">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">Add organization</div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
