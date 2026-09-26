import type { QueueConsumer } from "../queue";
import { downloadDocument } from "./download-document";
import { fetchDetail } from "./fetch-detail";
import { syncWindow } from "./sync-window";

// One consumer reads one message at a time, so the portal only ever sees a
// single session. A sync of a 7-day window takes a few minutes. Document
// downloads run here too: the files are served by the same server.
export const ingestConsumer: QueueConsumer = {
    queue: "ingest",
    visibilityTimeoutSeconds: 30 * 60,
    maxAttempts: 3,
    handlers: {
        sync_window: syncWindow,
        fetch_detail: fetchDetail,
        download_document: downloadDocument,
    },
};
