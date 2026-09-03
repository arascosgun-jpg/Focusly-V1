import { app } from "electron";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

/**
 * Returns (and creates if needed) the directory where Focusly keeps its own
 * copies of imported PDFs. The user's original files are never modified or
 * moved — we only ever read them once, to copy.
 */
export function getPdfStorageDir(): string {
  const dir = path.join(app.getPath("userData"), "pdfs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface CopiedPdf {
  id: string;
  name: string;
  originalPath: string;
  storedPath: string;
  sizeBytes: number;
}

/**
 * Strips characters that have no business in a display name (control
 * characters, stray path separators some OSes tolerate in filenames). This
 * is a display-safety measure only — storedPath never uses this value, so
 * it has no bearing on filesystem safety.
 */
function sanitizeDisplayName(rawName: string): string {
  // eslint-disable-next-line no-control-regex
  return rawName.replace(/[\x00-\x1f\x7f]/g, "").trim() || "Untitled.pdf";
}

/**
 * Cheap structural check that a file is plausibly a PDF before we bother
 * copying and indexing it — real PDFs start with the "%PDF-" magic bytes.
 * This catches renamed non-PDF files and empty/zero-byte files early with
 * a clear error instead of a confusing failure later in the pipeline.
 */
function looksLikePdf(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(5);
    const bytesRead = fs.readSync(fd, header, 0, 5, 0);
    return bytesRead === 5 && header.toString("ascii") === "%PDF-";
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Copies a single PDF file from the user's filesystem into Focusly's
 * managed storage directory under a generated id, so renames/deletes inside
 * the app never touch the user's original file. Runs asynchronously so a
 * large file doesn't block the main process (window/IPC handling) while it
 * copies.
 */
export async function copyPdfIntoStorage(originalPath: string): Promise<CopiedPdf> {
  const stat = await fs.promises.stat(originalPath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${originalPath}`);
  }
  if (stat.size === 0) {
    throw new Error("File is empty (0 bytes)");
  }
  if (!looksLikePdf(originalPath)) {
    throw new Error("File does not look like a valid PDF (missing %PDF- header)");
  }

  const id = randomUUID();
  const storedPath = path.join(getPdfStorageDir(), `${id}.pdf`);

  try {
    await fs.promises.copyFile(originalPath, storedPath);
  } catch (err) {
    // Make sure a partial copy never lingers as an orphaned file.
    await fs.promises.unlink(storedPath).catch(() => {});
    throw err;
  }

  return {
    id,
    name: sanitizeDisplayName(path.basename(originalPath)),
    originalPath,
    storedPath,
    sizeBytes: stat.size,
  };
}

/**
 * Deletes Focusly's managed copy of a PDF. Never touches the user's
 * original file, which lives outside this storage directory. Failures are
 * logged rather than thrown — losing the database record for a PDF is
 * worse for the user than leaving an orphaned file on disk, so a file-
 * system error here should never block removing the library entry.
 */
export async function deleteStoredPdf(storedPath: string): Promise<void> {
  try {
    await fs.promises.unlink(storedPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error(`Failed to delete stored PDF at ${storedPath}:`, err);
    }
  }
}
