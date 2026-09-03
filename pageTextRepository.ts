import { getDatabase } from "./database";

export interface PageTextInput {
  pageNumber: number;
  text: string;
}

export interface ContentSearchResult {
  pdfId: string;
  pageNumber: number;
  snippet: string;
}

/**
 * Replaces all indexed page text for a PDF. Called once per successful
 * extraction (and again on re-index), never incrementally, so there's no
 * risk of stale/duplicate rows after a re-run.
 */
export function replacePageText(pdfId: string, pages: PageTextInput[]): void {
  const db = getDatabase();
  const deleteExisting = db.prepare(`DELETE FROM pdf_page_text WHERE pdf_id = ?`);
  const insert = db.prepare(
    `INSERT INTO pdf_page_text (pdf_id, page_number, content) VALUES (?, ?, ?)`
  );

  const run = db.transaction((rows: PageTextInput[]) => {
    deleteExisting.run(pdfId);
    for (const row of rows) {
      if (row.text.trim().length === 0) continue;
      insert.run(pdfId, row.pageNumber, row.text);
    }
  });

  run(pages);
}

export function deletePageTextForPdf(pdfId: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM pdf_page_text WHERE pdf_id = ?`).run(pdfId);
}

/**
 * Full-text search across every indexed PDF's content. Uses FTS5's
 * built-in snippet() to return a short excerpt around the match, with the
 * matching term wrapped in [[ ]] markers the renderer can highlight.
 */
export function searchPageText(query: string, limit = 40): ContentSearchResult[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT pdf_id as pdfId, page_number as pageNumber,
              snippet(pdf_page_text, 2, '[[', ']]', '...', 12) as snippet
       FROM pdf_page_text
       WHERE pdf_page_text MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as ContentSearchResult[];
  return rows;
}
