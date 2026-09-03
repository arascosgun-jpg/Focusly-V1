import { randomUUID } from "crypto";
import { getDatabase } from "./database";
import type { BookmarkRecord } from "../types";

interface BookmarkRow {
  id: string;
  pdf_id: string;
  page_number: number;
  created_at: number;
}

function rowToRecord(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    pdfId: row.pdf_id,
    pageNumber: row.page_number,
    createdAt: row.created_at,
  };
}

/**
 * Bookmarks a page. Duplicates are prevented by the table's
 * UNIQUE (pdf_id, page_number) constraint — re-bookmarking a page that's
 * already bookmarked is a no-op that returns the existing bookmark rather
 * than an error, since that matches what the user means by the action.
 */
export function createBookmark(pdfId: string, pageNumber: number): BookmarkRecord {
  const db = getDatabase();
  const id = randomUUID();
  const createdAt = Date.now();

  db.prepare(
    `INSERT OR IGNORE INTO bookmarks (id, pdf_id, page_number, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, pdfId, pageNumber, createdAt);

  const row = db
    .prepare(`SELECT * FROM bookmarks WHERE pdf_id = ? AND page_number = ?`)
    .get(pdfId, pageNumber) as BookmarkRow;
  return rowToRecord(row);
}

export function listBookmarksForPdf(pdfId: string): BookmarkRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(`SELECT * FROM bookmarks WHERE pdf_id = ? ORDER BY page_number ASC`)
    .all(pdfId) as BookmarkRow[];
  return rows.map(rowToRecord);
}

export function deleteBookmark(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(id);
}
