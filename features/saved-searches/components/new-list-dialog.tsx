"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FilterOptions } from "../schemas";
import { SavedSearchForm } from "./saved-search-form";

const TITLE = "Nueva lista";
const DESCRIPTION = "Defina qué sigue esta lista, y en qué procesos.";

/** The «+» of the pane's lists: «Nueva lista» without leaving the opportunities, in a dialog on wide screens and a drawer from the bottom on phones. */
export function NewListDialog({
    orgId,
    orgSlug,
    filterOptions,
    hasProfile,
}: {
    orgId: string;
    orgSlug: string;
    filterOptions: FilterOptions;
    hasProfile: boolean;
}) {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();
    // Rendered here, not passed from the server: Radix's asChild cannot clone a server-rendered element.
    const trigger = (
        <Button variant="ghost" size="icon" className="size-6" aria-label="Nueva lista">
            <Plus />
        </Button>
    );
    const form = <SavedSearchForm orgId={orgId} orgSlug={orgSlug} search={null} filterOptions={filterOptions} hasProfile={hasProfile} onClose={() => setOpen(false)} />;

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent className="max-h-[90svh]">
                    <DrawerHeader className="text-left">
                        <DrawerTitle>{TITLE}</DrawerTitle>
                        <DrawerDescription>{DESCRIPTION}</DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-4">{form}</div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{TITLE}</DialogTitle>
                    <DialogDescription>{DESCRIPTION}</DialogDescription>
                </DialogHeader>
                {form}
            </DialogContent>
        </Dialog>
    );
}
