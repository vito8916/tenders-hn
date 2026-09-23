"use client";

import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

// The year is read on the client only, so prerendered HTML never bakes in a stale year.
export function CopyrightYear() {
    const year = useSyncExternalStore(
        subscribeToNothing,
        () => new Date().getFullYear(),
        () => null,
    );

    if (year === null) {
        return null;
    }

    return <>{year}</>;
}
