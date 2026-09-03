import fs from "fs";
import { extractPdfText } from "./textExtraction";
import { replacePageText } from "../db/pageTextRepository";
import { getPdfById, updatePdfTextStatus, listPdfsPendingText } from "../db/pdfRepository";

// Extraction can be CPU-heavy; a simple serial queue keeps several imports
// at once from all trying to parse PDFs simultaneously on the main thread.
let queue: Promise<void> = Promise.resolve();

export function queueIndexPdf(pdfId: string): void {
  queue = queue.then(() => indexPdf(pdfId)).catch(() => {
    // Errors are already recorded on the pdf row inside indexPdf; swallow
    // here so one failed PDF never breaks the queue for the rest.
  });
}

export async function indexPdf(pdfId: string): Promise<void> {
  const record = getPdfById(pdfId);
  if (!record) return;

  try {
    const bytes = fs.readFileSync(record.storedPath);
    const pages = await extractPdfText(new Uint8Array(bytes));
    replacePageText(pdfId, pages);
    updatePdfTextStatus(pdfId, "done", null);
  } catch (err) {
    updatePdfTextStatus(pdfId, "failed", (err as Error).message);
  }
}

/**
 * Called once on app startup. Picks up any PDF still marked "pending" —
 * e.g. the app was closed before its extraction finished — and queues it.
 */
export function resumePendingIndexing(): void {
  for (const pdf of listPdfsPendingText()) {
    queueIndexPdf(pdf.id);
  }
}
