"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * On small screens the opportunities pane opens from a menu (spec 0.4 §12.3). It closes when a view or list is
 * chosen, and on any other change of page, such as opening the list just created from «Nueva lista».
 */
export function OpportunitiesSheet({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Open only on the page it was opened on, so leaving the page closes it.
    const [openOn, setOpenOn] = useState<string | null>(null);
    const open = openOn === pathname;
    const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                    <ListIcon />
                    Oportunidades
                </Button>
            </SheetTrigger>
            <SheetContent
                side="left"
                className="overflow-y-auto"
                onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
                }}
            >
                <SheetTitle className="sr-only">Oportunidades</SheetTitle>
                {children}
            </SheetContent>
        </Sheet>
    );
}
