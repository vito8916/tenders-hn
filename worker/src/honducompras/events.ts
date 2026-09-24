import type { ProcessDetail } from "./parse";

export interface ProcessEvent {
    kind: "created" | "stage_changed" | "deadline_changed" | "document_added" | "document_removed";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
}

/**
 * Events between two versions of a detail page. A document replaced under
 * the same URL is detected when it is downloaded (Phase 2), not here.
 */
export function diffDetails(previous: ProcessDetail | null, next: ProcessDetail): ProcessEvent[] {
    if (!previous) {
        return [{ kind: "created", before: null, after: { stage: next.stage, bidsDueAt: next.bidsDueAt } }];
    }

    const events: ProcessEvent[] = [];

    if (previous.stage !== next.stage) {
        events.push({ kind: "stage_changed", before: { stage: previous.stage }, after: { stage: next.stage } });
    }

    if (previous.bidsDueAt !== next.bidsDueAt || previous.clarificationsDueAt !== next.clarificationsDueAt) {
        events.push({
            kind: "deadline_changed",
            before: { bidsDueAt: previous.bidsDueAt, clarificationsDueAt: previous.clarificationsDueAt },
            after: { bidsDueAt: next.bidsDueAt, clarificationsDueAt: next.clarificationsDueAt },
        });
    }

    const previousUrls = new Set(previous.documents.map((document) => document.url));
    const nextUrls = new Set(next.documents.map((document) => document.url));

    for (const document of next.documents) {
        if (!previousUrls.has(document.url)) {
            events.push({ kind: "document_added", before: null, after: { title: document.title, url: document.url } });
        }
    }
    for (const document of previous.documents) {
        if (!nextUrls.has(document.url)) {
            events.push({ kind: "document_removed", before: { title: document.title, url: document.url }, after: null });
        }
    }

    return events;
}
