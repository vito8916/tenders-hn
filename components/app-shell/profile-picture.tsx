"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials } from "@/lib/utils";

export default function ProfilePicture({fullName, avatarUrl,className,}: { fullName: string, avatarUrl: string, className?: string; }) {

    return (
        <Avatar className={cn("h-24 w-24 border-2 border-primary/20 rounded-full", className)}>
            <AvatarImage className="object-cover object-center p-0" src={avatarUrl} alt="Profile picture" />
            <AvatarFallback className="text-lg font-semibold bg-primary/10">
                {getInitials(fullName)}
            </AvatarFallback>
        </Avatar>
    );
}

export function ProfilePictureSkeleton() {
    return <Skeleton className="h-24 w-24 rounded-full" />;
}
