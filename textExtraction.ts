export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

/**
 * Extracts per-page text from a PDF's raw bytes. Runs in the main process
 * using pdf.js's Node-targeted "legacy" build (no DOM/canvas involved —
 * this only walks the text layer, it doesn't render anything).
 *
 * Uses a dynamic import because pdfjs-dist's legacy build ships as an ES
 * module; electron/ compiles to CommonJS, and Node's CommonJS can still
 * `import()` an ESM module at runtime.
 */
export async function extractPdfText(fileBytes: Uint8Array): Promise<ExtractedPage[]> {
  const pdfjsLib: typeof import("pdfjs-dist/legacy/build/pdf.mjs") = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  const loadingTask = pdfjsLib.getDocument({
    data: fileBytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      try {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push({ pageNumber, text });
        page.cleanup();
      } catch (pageErr) {
        // One malformed page shouldn't sink extraction for the whole
        // document — record it as empty (searchable-by-nothing) and move
        // on, so every other page's text still gets indexed.
        console.error(`Failed to extract text from page ${pageNumber}:`, pageErr);
        pages.push({ pageNumber, text: "" });
      }
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}
