"use client";

import { useSyncExternalStore } from "react";

function getNextPath(): string | undefined {
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : undefined;
}

export function useAuthNextPath(): string | undefined {
    return useSyncExternalStore(
        () => () => {},
        getNextPath,
        () => undefined,
    );
}

export function authPathWithNext(basePath: string, nextPath?: string) {
    return nextPath ? `${basePath}?next=${encodeURIComponent(nextPath)}` : basePath;
}
