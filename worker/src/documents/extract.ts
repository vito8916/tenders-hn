import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// poppler-utils and tesseract-ocr-spa come from the worker image (brew install poppler tesseract tesseract-lang locally).
const run = promisify(execFile);
const TOOL_TIMEOUT_MS = 2 * 60_000;
// A page with fewer visible characters in its text layer is treated as scanned.
const MIN_TEXT_LAYER_CHARS = 100;
const OCR_DPI = "300";

export interface ExtractedPage {
    text: string;
    method: "text_layer" | "ocr";
    ocrConfidence: number | null;
}

/** Postgres text cannot hold NUL, and poppler ends every page with a form feed. */
function cleanText(text: string): string {
    return text.replaceAll("\u0000", "").replaceAll("\f", "").trim();
}

function visibleChars(text: string): number {
    return text.replace(/\s/g, "").length;
}

/** Mean confidence (0-100) of the words in Tesseract TSV output, or null when it found none. */
export function meanWordConfidence(tsv: string): number | null {
    const confidences = tsv
        .split("\n")
        .slice(1)
        .map((line) => line.split("\t"))
        .filter((columns) => columns.length >= 12 && Number(columns[10]) >= 0 && columns[11].trim() !== "")
        .map((columns) => Number(columns[10]));

    if (confidences.length === 0) return null;
    return Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 100) / 100;
}

export async function pdfPageCount(file: string): Promise<number> {
    const { stdout } = await run("pdfinfo", [file], { timeout: TOOL_TIMEOUT_MS });
    const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!pages) {
        throw new Error("pdfinfo reported no pages");
    }
    return pages;
}

/** OCR in Spanish; the image can be any format Tesseract reads (PNG, JPEG, TIFF). */
export async function ocrImage(image: string, workDir: string): Promise<ExtractedPage> {
    const outputBase = path.join(workDir, "ocr");
    await run("tesseract", [image, outputBase, "-l", "spa", "txt", "tsv"], { timeout: TOOL_TIMEOUT_MS });
    const [text, tsv] = await Promise.all([readFile(`${outputBase}.txt`, "utf8"), readFile(`${outputBase}.tsv`, "utf8")]);
    return { text: cleanText(text), method: "ocr", ocrConfidence: meanWordConfidence(tsv) };
}

/** The page's text layer, or OCR when the layer is (nearly) empty, as in scanned documents. */
export async function extractPdfPage(file: string, pageNumber: number, workDir: string): Promise<ExtractedPage> {
    const page = String(pageNumber);
    const { stdout } = await run("pdftotext", ["-f", page, "-l", page, "-enc", "UTF-8", file, "-"], {
        timeout: TOOL_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
    });
    const textLayer: ExtractedPage = { text: cleanText(stdout), method: "text_layer", ocrConfidence: null };
    if (visibleChars(textLayer.text) >= MIN_TEXT_LAYER_CHARS) {
        return textLayer;
    }

    const imageBase = path.join(workDir, `page-${page}`);
    await run("pdftoppm", ["-f", page, "-l", page, "-r", OCR_DPI, "-gray", "-png", "-singlefile", file, imageBase], {
        timeout: TOOL_TIMEOUT_MS,
    });
    try {
        const ocr = await ocrImage(`${imageBase}.png`, workDir);
        return visibleChars(ocr.text) > visibleChars(textLayer.text) ? ocr : textLayer;
    } finally {
        await rm(`${imageBase}.png`, { force: true });
    }
}
