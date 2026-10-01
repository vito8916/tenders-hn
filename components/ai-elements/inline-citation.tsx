"use client";

// AI Elements «Inline Citation» (elements.ai-sdk.dev), on a popover instead
// of a hover card with a carousel: it opens on tap too, and lists every
// source of the marker at once.

import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const InlineCitation = (props: ComponentProps<typeof Popover>) => <Popover {...props} />;

export const InlineCitationTrigger = ({ className, children, ...props }: ComponentProps<"button">) => (
    <PopoverTrigger asChild>
        <Badge asChild variant="secondary" className={cn("mx-0.5 cursor-pointer rounded-full px-1.5 py-0 align-baseline text-[0.7rem]", className)}>
            <button type="button" {...props}>
                {children}
            </button>
        </Badge>
    </PopoverTrigger>
);

export const InlineCitationBody = ({ className, ...props }: ComponentProps<typeof PopoverContent>) => (
    <PopoverContent className={cn("w-80 space-y-3 p-3", className)} {...props} />
);

export type InlineCitationSourceProps = ComponentProps<"div"> & { title: string; description?: string };

export const InlineCitationSource = ({ title, description, className, children, ...props }: InlineCitationSourceProps) => (
    <div className={cn("space-y-1", className)} {...props}>
        <h4 className="text-sm leading-tight font-medium">{title}</h4>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {children}
    </div>
);
