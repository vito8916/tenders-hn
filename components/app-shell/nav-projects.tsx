"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
  Folder,
  Forward,
  MoreHorizontal,
  StarOff,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useOrgContext } from "@/contexts/org-context"
import { toggleProjectFavoriteAction } from "@/features/projects/actions"

export function NavProjects() {
  const { isMobile } = useSidebar()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const { favoriteProjects } = useOrgContext()
  const [isPending, startTransition] = useTransition()

  if (favoriteProjects.length === 0) {
    return null
  }

  function handleUnfavorite(projectId: string) {
    startTransition(async () => {
      const result = await toggleProjectFavoriteAction({ projectId, orgSlug })
      if (!result.success) {
        toast.error(result.error ?? "Failed to remove favorite")
        return
      }
      toast.success("Removed from favorites")
    })
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarMenu>
        {favoriteProjects.map((project) => (
          <SidebarMenuItem key={project.id}>
            <SidebarMenuButton asChild>
              <Link href={`/organizations/${orgSlug}/projects/${project.slug}`}>
                <Folder />
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem asChild>
                  <Link href={`/organizations/${orgSlug}/projects/${project.slug}`}>
                    <Folder className="text-muted-foreground" />
                    <span>View Project</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() => handleUnfavorite(project.id)}
                >
                  <StarOff className="text-muted-foreground" />
                  <span>Remove favorite</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
