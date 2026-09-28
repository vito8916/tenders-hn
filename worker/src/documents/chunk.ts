// About 500 tokens of Spanish text: a page is ~2,100 characters on average.
export const CHUNK_CHARS = 2_000;
// Carried over from the end of the previous chunk so a requirement split
// across a chunk boundary is still found whole in one of them.
export const OVERLAP_CHARS = 300;

export interface PageText {
    pageNumber: number;
    text: string;
}

export interface Chunk {
    ordinal: number;
    pageStart: number;
    pageEnd: number;
    content: string;
}

interface Piece {
    pageNumber: number;
    text: string;
}

/** Collapses the column padding and blank runs that pdftotext and OCR leave. */
function normalize(text: string): string {
    return text
        .replace(/[^\S\n]+/g, " ")
        .replace(/ ?\n ?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Splits text longer than `limit` at the last paragraph, line, or word break before it. */
function splitLong(text: string, limit: number): string[] {
    const parts: string[] = [];
    let rest = text;
    while (rest.length > limit) {
        const window = rest.slice(0, limit);
        const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
        const cut = breakAt > limit / 2 ? breakAt : limit;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
}

/** The end of `text`, at most `limit` characters, starting at a word. */
function tail(text: string, limit: number): string {
    if (text.length <= limit) return text;
    const start = text.length - limit;
    const wordStart = text.indexOf(" ", start);
    return text.slice(wordStart === -1 ? start : wordStart + 1);
}

/**
 * Builds retrieval chunks from a document's pages in order. Paragraphs are
 * packed into chunks of up to CHUNK_CHARS; short pages share a chunk and
 * long ones span several. Each chunk after the first starts with the last
 * OVERLAP_CHARS of the previous one and records the pages its text came from.
 */
export function chunkPages(pages: PageText[]): Chunk[] {
    const pieces: Piece[] = pages.flatMap((page) =>
        normalize(page.text)
            .split("\n\n")
            .flatMap((paragraph) => splitLong(paragraph, CHUNK_CHARS - OVERLAP_CHARS))
            .filter((text) => text !== "")
            .map((text) => ({ pageNumber: page.pageNumber, text })),
    );

    const chunks: Chunk[] = [];
    let current: Piece[] = [];
    // Pieces in `current` beyond the overlap carried from the previous chunk.
    let newPieces = 0;
    const length = (group: Piece[]) => group.reduce((sum, piece) => sum + piece.text.length + 2, 0);

    const emit = () => {
        chunks.push({
            ordinal: chunks.length,
            pageStart: current[0].pageNumber,
            pageEnd: current[current.length - 1].pageNumber,
            content: current.map((piece) => piece.text).join("\n\n"),
        });
        const last = current[current.length - 1];
        current = [{ pageNumber: last.pageNumber, text: tail(last.text, OVERLAP_CHARS) }];
        newPieces = 0;
    };

    for (const piece of pieces) {
        if (newPieces > 0 && length(current) + piece.text.length > CHUNK_CHARS) {
            emit();
        }
        current.push(piece);
        newPieces++;
    }
    if (newPieces > 0) {
        emit();
    }

    return chunks;
}
