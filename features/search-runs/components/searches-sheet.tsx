"use client";

import { useState } from "react";
import { ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** On small screens the searches pane opens from a menu (spec §12.3) and closes when a search or run is chosen. */
export function SearchesSheet({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                    <ListIcon />
                    Búsquedas
                </Button>
            </SheetTrigger>
            <SheetContent
                side="left"
                className="overflow-y-auto"
                onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
                }}
            >
                <SheetTitle className="sr-only">Búsquedas</SheetTitle>
                {children}
            </SheetContent>
        </Sheet>
    );
}
