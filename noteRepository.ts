import { randomUUID } from "crypto";
import { getDatabase } from "./database";
import type { NoteRecord } from "../types";

interface NoteRow {
  id: string;
  pdf_id: string;
  page_number: number | null;
  content: string;
  created_at: number;
  updated_at: number;
}

function rowToRecord(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    pdfId: row.pdf_id,
    pageNumber: row.page_number,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createNote(
  pdfId: string,
  pageNumber: number | null,
  content: string
): NoteRecord {
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO notes (id, pdf_id, page_number, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, pdfId, pageNumber, content, now, now);
  return { id, pdfId, pageNumber, content, createdAt: now, updatedAt: now };
}

export function listNotesForPdf(pdfId: string): NoteRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM notes WHERE pdf_id = ?
       ORDER BY CASE WHEN page_number IS NULL THEN 1 ELSE 0 END, page_number ASC, created_at DESC`
    )
    .all(pdfId) as NoteRow[];
  return rows.map(rowToRecord);
}

export function getNoteById(id: string): NoteRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function updateNote(id: string, content: string): NoteRecord | null {
  const db = getDatabase();
  db.prepare(`UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`).run(
    content,
    Date.now(),
    id
  );
  return getNoteById(id);
}

export function deleteNote(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
}
