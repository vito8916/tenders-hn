import type { QueueConsumer } from "../queue";
import { evaluateMatchJob } from "./evaluate-match";
import { renderOrgReport } from "./render-org-report";
import { renderReport } from "./render-report";
import { searchRun } from "./search-run";

// Jev calls take seconds and never touch the portal or OCR, so matching has
// its own queue: a run's candidates never wait behind a sync or a long scan.
export const matchConsumer: QueueConsumer = {
    queue: "match",
    visibilityTimeoutSeconds: 5 * 60,
    maxAttempts: 3,
    handlers: {
        evaluate_match: evaluateMatchJob,
        search_run: searchRun,
        render_report: renderReport,
        render_org_report: renderOrgReport,
    },
};
