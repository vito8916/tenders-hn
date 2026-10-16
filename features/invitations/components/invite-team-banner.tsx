"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeToStorage = (onChange: () => void) => {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
};

/** Asks the organization's only member to invite their team; dismissing it is remembered in this browser. */
export function InviteTeamBanner({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
    const storageKey = `invite-team-banner-dismissed:${orgId}`;
    const [dismissedNow, setDismissedNow] = useState(false);
    // The server and the first render treat it as dismissed, so the banner never flashes for someone who closed it.
    const dismissedBefore = useSyncExternalStore(
        subscribeToStorage,
        () => {
            try {
                return localStorage.getItem(storageKey) !== null;
            } catch {
                return false;
            }
        },
        () => true,
    );

    if (dismissedNow || dismissedBefore) return null;

    const dismiss = () => {
        setDismissedNow(true);
        try {
            localStorage.setItem(storageKey, "1");
        } catch {}
    };

    return (
        <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <UserPlus className="size-4 shrink-0 text-muted-foreground" />
            <p className="flex-1">Invite a su equipo para que también reciba los reportes.</p>
            <Button asChild size="sm">
                <Link href={`/organizations/${orgSlug}/members?invitar=1`}>Invitar</Link>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={dismiss}>
                <X />
                <span className="sr-only">Descartar</span>
            </Button>
        </div>
    );
}
