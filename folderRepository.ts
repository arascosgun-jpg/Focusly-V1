import { randomUUID } from "crypto";
import { getDatabase } from "./database";
import type { FolderRecord } from "../types";

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
}

function rowToRecord(row: FolderRow): FolderRecord {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function createFolder(name: string): FolderRecord {
  const db = getDatabase();
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(`INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)`).run(
    id,
    name,
    createdAt
  );
  return { id, name, createdAt };
}

export function listFolders(): FolderRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM folders ORDER BY name ASC`).all() as FolderRow[];
  return rows.map(rowToRecord);
}

export function getFolderById(id: string): FolderRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM folders WHERE id = ?`).get(id) as FolderRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function renameFolder(id: string, name: string): FolderRecord | null {
  const db = getDatabase();
  db.prepare(`UPDATE folders SET name = ? WHERE id = ?`).run(name, id);
  return getFolderById(id);
}

/**
 * Deletes a folder. PDFs that were inside it are NOT deleted — the
 * ON DELETE SET NULL foreign key returns them to the main library
 * automatically, matching the "remove PDFs from folders and return them to
 * the main library" requirement.
 */
export function deleteFolder(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
}
