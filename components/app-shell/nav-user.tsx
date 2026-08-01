"use client"

import {
    BadgeCheck,
    Bell,
    ChevronsUpDown,
    LogOut,
} from "lucide-react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { signOutAction } from "@/features/auth/actions"
import { capitalizeText, getInitials } from "@/lib/utils";
import Link from "next/link";
import ProfilePicture from "@/components/app-shell/profile-picture";
import { Profile } from "@/features/profiles/schemas"

interface NavUserProps {
    profile: Profile;
}

/**
 * NavUser - Client component for interactive user menu
 * Receives resolved user data as props (no promise unwrapping needed)
 */
export function NavUser({ profile }: NavUserProps) {
    const { isMobile } = useSidebar()

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <ProfilePicture
                                fullName={profile.fullName ?? ""}
                                avatarUrl={profile.avatarUrl ?? ""}
                                className="h-8 w-8 rounded-lg"
                            />
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {capitalizeText(profile.fullName)}
                                </span>
                                <span className="truncate text-xs">{profile.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={profile.avatarUrl ?? ""} />
                                    <AvatarFallback className="text-lg font-semibold bg-primary/10">
                                        {getInitials(profile.fullName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">
                                        {capitalizeText(profile.fullName)}
                                    </span>
                                    <span className="truncate text-xs">{profile.email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <Link className="flex items-center gap-2 w-full" href="/settings">
                                    <BadgeCheck />
                                    Settings
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Bell />
                                Notifications
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => signOutAction()}>
                            <LogOut />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
