import { ipcMain } from "electron";
import { searchPdfsByName, getPdfById } from "../db/pdfRepository";
import { searchPageText } from "../db/pageTextRepository";
import { queueIndexPdf } from "../search/indexer";
import { assert, isNonEmptyString } from "./validate";

export interface SmartSearchResult {
  pdfId: string;
  pdfName: string;
  pageNumber: number | null;
  snippet: string | null;
  matchType: "name" | "content";
}

/**
 * Escapes an FTS5 query so arbitrary user input can't be interpreted as
 * FTS5 query syntax (column filters, boolean operators, etc). Wrapping the
 * whole query in double quotes makes it a single literal phrase match.
 */
function toFtsPhraseQuery(raw: string): string {
  return `"${raw.replace(/"/g, '""')}"`;
}

export function registerSearchHandlers(): void {
  ipcMain.handle("search:smart", async (_event, query: unknown): Promise<SmartSearchResult[]> => {
    assert(isNonEmptyString(query), "query must be a non-empty string");
    const trimmed = query.trim();

    const nameMatches = searchPdfsByName(trimmed).map<SmartSearchResult>((pdf) => ({
      pdfId: pdf.id,
      pdfName: pdf.name,
      pageNumber: null,
      snippet: null,
      matchType: "name",
    }));

    let contentMatches: SmartSearchResult[] = [];
    try {
      contentMatches = searchPageText(toFtsPhraseQuery(trimmed)).map((row) => {
        const pdf = getPdfById(row.pdfId);
        return {
          pdfId: row.pdfId,
          pdfName: pdf?.name ?? "Unknown PDF",
          pageNumber: row.pageNumber,
          snippet: row.snippet,
          matchType: "content" as const,
        };
      });
    } catch {
      // Malformed FTS query (e.g. only punctuation) — fall back to
      // name-only results rather than failing the whole search.
    }

    return [...nameMatches, ...contentMatches];
  });

  ipcMain.handle("search:reindex", async (_event, pdfId: unknown) => {
    assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
    queueIndexPdf(pdfId);
    return true;
  });
}
