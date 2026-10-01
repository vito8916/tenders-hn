import type { Citation, ChatSource } from "./schemas";

/** [S3], or several ids in one bracket: [S1, S4]. */
const CITATION_PATTERN = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

const idsIn = (group: string) => group.split(",").map((id) => id.trim());

/**
 * Checks every source id an answer cites against the sources the model was
 * given (plan §5.4). Unknown ids are removed from the text; the answer is
 * unverified when it cited an unknown id or no source at all.
 */
export function validateCitations(answer: string, sources: ChatSource[]) {
    const known = new Map(sources.map(({ text: _text, ...citation }) => [citation.id, citation]));
    const cited = new Map<string, Citation>();
    const unknownIds: string[] = [];

    const content = answer
        .replace(new RegExp(` ?${CITATION_PATTERN.source}`, "g"), (marker, group: string) => {
            const valid = idsIn(group).filter((id) => {
                const citation = known.get(id);
                if (!citation) {
                    unknownIds.push(id);
                    return false;
                }
                if (!cited.has(id)) cited.set(id, citation);
                return true;
            });
            if (valid.length === 0) return "";
            return `${marker.startsWith(" ") ? " " : ""}[${valid.join(", ")}]`;
        })
        .trim();

    const citations = [...cited.values()];
    return { content, citations, unknownIds, unverified: unknownIds.length > 0 || citations.length === 0 };
}

/**
 * Splits an answer into text and citation markers for rendering. With the
 * validated citations, ids outside them are dropped; while the answer is still
 * streaming (no citations yet), every marker is kept.
 */
export function splitCitations(content: string, citations: Citation[] | undefined) {
    const byId = new Map(citations?.map((citation) => [citation.id, citation]));
    const parts: Array<{ type: "text"; text: string } | { type: "citation"; ids: string[]; citations: Citation[] }> = [];
    let last = 0;

    for (const match of content.matchAll(CITATION_PATTERN)) {
        const index = match.index ?? 0;
        if (index > last) parts.push({ type: "text", text: content.slice(last, index) });
        last = index + match[0].length;

        const ids = idsIn(match[1]).filter((id) => !citations || byId.has(id));
        if (ids.length > 0) {
            parts.push({ type: "citation", ids, citations: ids.flatMap((id) => byId.get(id) ?? []) });
        }
    }
    if (last < content.length) parts.push({ type: "text", text: content.slice(last) });
    return parts;
}

/** «Pliego.pdf, pág. 3» or «Ficha del proceso LPN-008-2026»: how a citation reads to a person. */
export function citationLabel(citation: Citation) {
    if (citation.kind === "process") return `Ficha del proceso ${citation.expediente}`;
    const pages =
        citation.pageStart === null
            ? ""
            : citation.pageEnd !== null && citation.pageEnd !== citation.pageStart
              ? `, págs. ${citation.pageStart}-${citation.pageEnd}`
              : `, pág. ${citation.pageStart}`;
    return `${citation.title}${pages}`;
}

/**
 * The answer as markdown for rendering, each citation marker as a
 * `<cita ids="S2,S3">` tag the chat renders as a source chip.
 */
export function toCitationMarkup(content: string, citations: Citation[] | undefined) {
    return splitCitations(content, citations)
        .map((part) => (part.type === "text" ? part.text : `<cita ids="${part.ids.join(",")}">${part.ids.join(", ")}</cita>`))
        .join("");
}
