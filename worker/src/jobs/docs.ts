import type { QueueConsumer } from "../queue";
import { extractDocument } from "./extract-document";

// Extraction is CPU only and never calls the portal, so it has its own queue
// and consumer: a long OCR job never delays a sync. Pages are stored as they
// finish, so a job that outlives its visibility timeout resumes, not restarts.
export const docsConsumer: QueueConsumer = {
    queue: "docs",
    visibilityTimeoutSeconds: 30 * 60,
    maxAttempts: 3,
    handlers: {
        extract_document: extractDocument,
    },
};
