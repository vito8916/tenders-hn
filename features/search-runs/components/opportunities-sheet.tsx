"use client";

import { useState } from "react";
import { ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** On small screens the opportunities pane opens from a menu (spec 0.4 §12.3) and closes when a view or list is chosen. */
export function OpportunitiesSheet({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

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
