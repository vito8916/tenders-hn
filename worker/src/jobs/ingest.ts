import type { QueueConsumer } from "../queue";
import { fetchDetail } from "./fetch-detail";
import { syncWindow } from "./sync-window";

// One consumer reads one message at a time, so the portal only ever sees a
// single session. A sync of a 7-day window takes a few minutes.
export const ingestConsumer: QueueConsumer = {
    queue: "ingest",
    visibilityTimeoutSeconds: 30 * 60,
    maxAttempts: 3,
    handlers: {
        sync_window: syncWindow,
        fetch_detail: fetchDetail,
    },
};
