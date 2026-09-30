"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 5_000;

/** Re-renders the page every few seconds while a run is queued or running, so its result appears without a reload. */
export function RefreshWhileActive() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => router.refresh(), REFRESH_MS);
        return () => clearInterval(interval);
    }, [router]);

    return null;
}
