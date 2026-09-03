import Database from "better-sqlite3";
import { app, dialog } from "electron";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

/**
 * Returns the singleton SQLite connection, creating the database file and
 * tables on first access. Lives entirely in the main process — the renderer
 * never touches this file or module directly.
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const dbPath = path.join(userDataDir, "focusly.db");

  try {
    db = openAndPrepare(dbPath);
  } catch (err) {
    // A corrupted database file would otherwise make Focusly unstartable
    // with no way out from inside the app. Move the bad file aside and
    // start fresh, telling the user exactly where their old file went so
    // it can be recovered manually if they want to try.
    console.error("Failed to open the database, treating it as corrupt:", err);
    const backupPath = `${dbPath}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(dbPath, backupPath);
      // Clean up WAL sidecar files too, or SQLite may reapply bad state.
      for (const suffix of ["-wal", "-shm"]) {
        if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
      }
      dialog.showErrorBox(
        "Focusly database could not be opened",
        `Your Focusly database appears to be damaged, so a new empty one was created.\n\n` +
          `Your imported PDF files themselves are untouched. The damaged database was ` +
          `saved here in case you want to recover it:\n\n${backupPath}`
      );
    } catch (renameErr) {
      console.error("Could not move the corrupt database aside:", renameErr);
      throw err;
    }
    db = openAndPrepare(dbPath);
  }

  return db;
}

function openAndPrepare(dbPath: string): Database.Database {
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  // Surfaces structural damage now (at startup, where it's handled above)
  // rather than mid-operation later.
  database.pragma("quick_check");

  database.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pdfs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_path TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      imported_at INTEGER NOT NULL,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      text_status TEXT NOT NULL DEFAULT 'pending',
      text_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pdfs_folder_id ON pdfs(folder_id);
    CREATE INDEX IF NOT EXISTS idx_pdfs_name ON pdfs(name);
    CREATE INDEX IF NOT EXISTS idx_pdfs_original_path ON pdfs(original_path);

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      pdf_id TEXT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
      page_number INTEGER,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      pdf_id TEXT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (pdf_id, page_number)
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      pdf_id TEXT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_pdf_id ON notes(pdf_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_pdf_id ON bookmarks(pdf_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_pdf_id ON study_sessions(pdf_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON study_sessions(started_at);
  `);

  // FTS5 ships in better-sqlite3's bundled SQLite by default, but this is
  // created separately so that if some environment's build ever lacks it,
  // Focusly still starts up — content search just degrades to filename-only
  // (see searchHandlers.ts) instead of the whole app crashing.
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS pdf_page_text USING fts5(
        pdf_id UNINDEXED,
        page_number UNINDEXED,
        content
      );
    `);
  } catch (err) {
    console.error("FTS5 unavailable — PDF content search will be disabled:", err);
  }

  migrate(database);
  return database;
}

/**
 * Additive migrations for databases created by earlier builds. Every step
 * is guarded so this is a safe no-op on a fresh install and on a database
 * that's already up to date. Never drops user data.
 */
function migrate(database: Database.Database): void {
  const pdfColumns = new Set(
    (database.prepare(`PRAGMA table_info(pdfs)`).all() as { name: string }[]).map((c) => c.name)
  );
  if (!pdfColumns.has("text_status")) {
    database.exec(`ALTER TABLE pdfs ADD COLUMN text_status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!pdfColumns.has("text_error")) {
    database.exec(`ALTER TABLE pdfs ADD COLUMN text_error TEXT`);
  }

  // Notes gained an updated_at column when editing was added. Backfill it
  // from created_at so existing notes have a sensible value.
  const noteColumns = new Set(
    (database.prepare(`PRAGMA table_info(notes)`).all() as { name: string }[]).map((c) => c.name)
  );
  if (noteColumns.size > 0 && !noteColumns.has("updated_at")) {
    database.exec(`ALTER TABLE notes ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
    database.exec(`UPDATE notes SET updated_at = created_at WHERE updated_at = 0`);
  }

  // Bookmarks dropped their unused free-text label and gained a uniqueness
  // constraint on (pdf_id, page_number). SQLite can't add a constraint in
  // place, so rebuild the table if the old shape is still present.
  const bookmarkColumns = new Set(
    (database.prepare(`PRAGMA table_info(bookmarks)`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );
  if (bookmarkColumns.has("label")) {
    const rebuild = database.transaction(() => {
      database.exec(`
        CREATE TABLE bookmarks_new (
          id TEXT PRIMARY KEY,
          pdf_id TEXT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
          page_number INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE (pdf_id, page_number)
        );
      `);
      // GROUP BY collapses any duplicate (pdf_id, page_number) rows the old
      // schema allowed, so the new UNIQUE constraint can't fail here.
      database.exec(`
        INSERT INTO bookmarks_new (id, pdf_id, page_number, created_at)
        SELECT MIN(id), pdf_id, page_number, MIN(created_at)
        FROM bookmarks
        GROUP BY pdf_id, page_number;
      `);
      database.exec(`DROP TABLE bookmarks`);
      database.exec(`ALTER TABLE bookmarks_new RENAME TO bookmarks`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_bookmarks_pdf_id ON bookmarks(pdf_id)`);
    });
    rebuild();
  }
}
