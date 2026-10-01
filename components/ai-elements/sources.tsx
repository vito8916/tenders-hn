"use client";

// AI Elements «Sources» (elements.ai-sdk.dev), in Spanish.

import { BookIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const Sources = ({ className, ...props }: ComponentProps<typeof Collapsible>) => (
    <Collapsible className={cn("not-prose text-xs text-primary", className)} {...props} />
);

export const SourcesTrigger = ({ className, count, children, ...props }: ComponentProps<typeof CollapsibleTrigger> & { count: number }) => (
    <CollapsibleTrigger className={cn("flex items-center gap-2", className)} {...props}>
        {children ?? (
            <>
                <p className="font-medium">{count === 1 ? "1 fuente verificada" : `${count} fuentes verificadas`}</p>
                <ChevronDownIcon className="size-4" />
            </>
        )}
    </CollapsibleTrigger>
);

export const SourcesContent = ({ className, ...props }: ComponentProps<typeof CollapsibleContent>) => (
    <CollapsibleContent
        className={cn(
            "mt-3 flex w-fit flex-col gap-2",
            "outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2",
            className,
        )}
        {...props}
    />
);

export const Source = ({ href, title, children, ...props }: ComponentProps<"a">) => (
    <a className="flex items-center gap-2" href={href} rel="noreferrer" target="_blank" {...props}>
        {children ?? (
            <>
                <BookIcon className="size-4 shrink-0" />
                <span className="block font-medium">{title}</span>
            </>
        )}
    </a>
);
