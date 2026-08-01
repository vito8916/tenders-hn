import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR/hydration and true once mounted on the client.
 * Avoids the setState-in-effect pattern for hydration-sensitive UI (e.g. theme).
 */
export function useMounted(): boolean {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
}
