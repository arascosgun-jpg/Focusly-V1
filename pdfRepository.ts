import { randomUUID } from "crypto";
import { getDatabase } from "./database";
import type { PdfRecord, TextStatus } from "../types";

interface PdfRow {
  id: string;
  name: string;
  original_path: string;
  stored_path: string;
  size_bytes: number;
  imported_at: number;
  folder_id: string | null;
  text_status: TextStatus;
  text_error: string | null;
}

function rowToRecord(row: PdfRow): PdfRecord {
  return {
    id: row.id,
    name: row.name,
    originalPath: row.original_path,
    storedPath: row.stored_path,
    sizeBytes: row.size_bytes,
    importedAt: row.imported_at,
    folderId: row.folder_id,
    textStatus: row.text_status,
    textError: row.text_error,
  };
}

export function insertPdf(input: {
  name: string;
  originalPath: string;
  storedPath: string;
  sizeBytes: number;
}): PdfRecord {
  const db = getDatabase();
  const id = randomUUID();
  const importedAt = Date.now();

  db.prepare(
    `INSERT INTO pdfs (id, name, original_path, stored_path, size_bytes, imported_at, folder_id)
     VALUES (@id, @name, @originalPath, @storedPath, @sizeBytes, @importedAt, NULL)`
  ).run({ id, importedAt, ...input });

  return {
    id,
    name: input.name,
    originalPath: input.originalPath,
    storedPath: input.storedPath,
    sizeBytes: input.sizeBytes,
    importedAt,
    folderId: null,
    textStatus: "pending",
    textError: null,
  };
}

export function listPdfs(folderId?: string | null): PdfRecord[] {
  const db = getDatabase();
  let rows: PdfRow[];

  if (folderId === undefined) {
    rows = db.prepare(`SELECT * FROM pdfs ORDER BY imported_at DESC`).all() as PdfRow[];
  } else if (folderId === null) {
    rows = db
      .prepare(`SELECT * FROM pdfs WHERE folder_id IS NULL ORDER BY imported_at DESC`)
      .all() as PdfRow[];
  } else {
    rows = db
      .prepare(`SELECT * FROM pdfs WHERE folder_id = ? ORDER BY imported_at DESC`)
      .all(folderId) as PdfRow[];
  }

  return rows.map(rowToRecord);
}

export function searchPdfsByName(query: string): PdfRecord[] {
  const db = getDatabase();
  const escaped = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const rows = db
    .prepare(`SELECT * FROM pdfs WHERE name LIKE ? ESCAPE '\\' ORDER BY imported_at DESC`)
    .all(`%${escaped}%`) as PdfRow[];
  return rows.map(rowToRecord);
}

export function getPdfById(id: string): PdfRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM pdfs WHERE id = ?`).get(id) as PdfRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function getPdfByOriginalPath(originalPath: string): PdfRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT * FROM pdfs WHERE original_path = ? LIMIT 1`)
    .get(originalPath) as PdfRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function renamePdf(id: string, name: string): PdfRecord | null {
  const db = getDatabase();
  db.prepare(`UPDATE pdfs SET name = ? WHERE id = ?`).run(name, id);
  return getPdfById(id);
}

export function movePdfToFolder(id: string, folderId: string | null): PdfRecord | null {
  const db = getDatabase();
  db.prepare(`UPDATE pdfs SET folder_id = ? WHERE id = ?`).run(folderId, id);
  return getPdfById(id);
}

export function deletePdfRow(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM pdfs WHERE id = ?`).run(id);
}

export function listPdfsPendingText(): PdfRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM pdfs WHERE text_status = 'pending'`).all() as PdfRow[];
  return rows.map(rowToRecord);
}

export function updatePdfTextStatus(id: string, status: TextStatus, error: string | null): void {
  const db = getDatabase();
  db.prepare(`UPDATE pdfs SET text_status = ?, text_error = ? WHERE id = ?`).run(
    status,
    error,
    id
  );
}
