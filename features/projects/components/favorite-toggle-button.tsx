"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleProjectFavoriteAction } from "../actions";

interface FavoriteToggleButtonProps {
    projectId: string;
    orgSlug: string;
    isFavorite: boolean;
    className?: string;
    size?: "default" | "sm" | "icon" | "icon-sm";
    variant?: "ghost" | "outline";
    showLabel?: boolean;
}

export function FavoriteToggleButton({
    projectId,
    orgSlug,
    isFavorite,
    className,
    size = "icon-sm",
    variant = "ghost",
    showLabel = false,
}: FavoriteToggleButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    function handleToggle() {
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite);
            const result = await toggleProjectFavoriteAction({ projectId, orgSlug });
            if (!result.success) {
                toast.error(result.error ?? "Failed to update favorite");
                return;
            }
            toast.success(result.isFavorite ? "Added to favorites" : "Removed from favorites");
        });
    }

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            className={cn(className)}
            disabled={isPending}
            aria-label={optimisticFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={optimisticFavorite}
            onClick={handleToggle}
        >
            <Star
                className={cn(
                    "size-4",
                    optimisticFavorite && "fill-amber-400 text-amber-400"
                )}
            />
            {showLabel ? (
                <span>{optimisticFavorite ? "Unfavorite" : "Favorite"}</span>
            ) : null}
        </Button>
    );
}
