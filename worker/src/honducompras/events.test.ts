import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffDetails } from "./events";
import { parseDetailPage, type ProcessDetail } from "./parse";

const detail = parseDetailPage(readFileSync(new URL("./__fixtures__/detail-LPN-008-2026.html", import.meta.url), "utf8"));

describe("diffDetails", () => {
    it("emits only created for the first version", () => {
        expect(diffDetails(null, detail)).toEqual([
            { kind: "created", before: null, after: { stage: "Recepción de Ofertas", bidsDueAt: "2026-11-10T10:00:00-06:00" } },
        ]);
    });

    it("emits nothing when the content is the same", () => {
        expect(diffDetails(detail, structuredClone(detail))).toEqual([]);
    });

    it("detects stage, deadline, and document changes", () => {
        const next: ProcessDetail = {
            ...detail,
            stage: "Evaluación",
            bidsDueAt: "2026-11-17T10:00:00-06:00",
            documents: [
                ...detail.documents.slice(0, 2),
                { title: "Enmienda No. 1", url: "http://h1.honducompras.gob.hn/Docs/Enmienda1.pdf", fileName: "Enmienda1.pdf", kind: "other" },
            ],
        };

        expect(diffDetails(detail, next).map((event) => event.kind)).toEqual([
            "stage_changed",
            "deadline_changed",
            "document_added",
            "document_removed",
        ]);
        expect(diffDetails(detail, next)[1]).toMatchObject({
            before: { bidsDueAt: "2026-11-10T10:00:00-06:00" },
            after: { bidsDueAt: "2026-11-17T10:00:00-06:00" },
        });
    });
});
