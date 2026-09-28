import type { QueueConsumer } from "../queue";
import { embedDocument } from "./embed-document";
import { embedProcess } from "./embed-process";
import { extractDocument } from "./extract-document";

// Extraction (CPU) and embedding (AI Gateway) never call the portal, so they
// have their own queue and consumer: a long OCR job never delays a sync.
// Pages are stored as they finish, so an extraction that outlives its
// visibility timeout resumes, not restarts.
export const docsConsumer: QueueConsumer = {
    queue: "docs",
    visibilityTimeoutSeconds: 30 * 60,
    maxAttempts: 3,
    handlers: {
        extract_document: extractDocument,
        embed_document: embedDocument,
        embed_process: embedProcess,
    },
};
