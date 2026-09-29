import type { QueueConsumer } from "../queue";
import { evaluateMatchJob } from "./evaluate-match";

// Jev calls take seconds and never touch the portal or OCR, so matching has
// its own queue: a run's candidates never wait behind a sync or a long scan.
export const matchConsumer: QueueConsumer = {
    queue: "match",
    visibilityTimeoutSeconds: 5 * 60,
    maxAttempts: 3,
    handlers: {
        evaluate_match: evaluateMatchJob,
    },
};
