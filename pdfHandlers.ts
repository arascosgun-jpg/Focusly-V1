import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import {
  insertPdf,
  listPdfs,
  renamePdf,
  deletePdfRow,
  getPdfById,
  getPdfByOriginalPath,
} from "../db/pdfRepository";
import { getDatabase } from "../db/database";
import { copyPdfIntoStorage, deleteStoredPdf } from "../pdf/storage";
import { queueIndexPdf } from "../search/indexer";
import { deletePageTextForPdf } from "../db/pageTextRepository";
import { assert, isNonEmptyString, isNullableString } from "./validate";
import type { ImportPdfResult } from "../types";

export function registerPdfHandlers(): void {
  ipcMain.handle("pdf:import", async (event): Promise<ImportPdfResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      title: "Import PDF files",
      properties: ["openFile", "multiSelections"] as const,
      filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled) {
      return { imported: [], skipped: [] };
    }

    const imported = [];
    const skipped: { path: string; reason: string }[] = [];

    for (const filePath of result.filePaths) {
      try {
        if (path.extname(filePath).toLowerCase() !== ".pdf") {
          skipped.push({ path: filePath, reason: "Not a .pdf file" });
          continue;
        }

        // Duplicate-import guard: if this exact source file was already
        // imported, don't create a second copy + database row for it.
        const existing = getPdfByOriginalPath(filePath);
        if (existing) {
          skipped.push({ path: filePath, reason: `Already imported as "${existing.name}"` });
          continue;
        }

        const copied = await copyPdfIntoStorage(filePath);
        const record = insertPdf({
          name: copied.name,
          originalPath: copied.originalPath,
          storedPath: copied.storedPath,
          sizeBytes: copied.sizeBytes,
        });
        imported.push(record);
        queueIndexPdf(record.id);
      } catch (err) {
        skipped.push({ path: filePath, reason: (err as Error).message });
      }
    }

    return { imported, skipped };
  });

  ipcMain.handle("pdf:list", async (_event, folderId: unknown) => {
    assert(
      isNullableString(folderId) || folderId === undefined,
      "folderId must be string, null, or undefined"
    );
    return listPdfs(folderId as string | null | undefined);
  });

  ipcMain.handle("pdf:rename", async (_event, id: unknown, name: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    assert(isNonEmptyString(name), "name must be a non-empty string");
    return renamePdf(id, name.trim());
  });

  ipcMain.handle("pdf:delete", async (_event, id: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    const record = getPdfById(id);
    if (!record) return false;

    // The two DB deletes must succeed or fail together: if the page-text
    // delete succeeded but the row delete then failed, we'd leave a pdf row
    // with no error but a silently empty search index. Deleting the pdfs
    // row also cascades to its notes, bookmarks, and study sessions via
    // ON DELETE CASCADE (foreign_keys = ON is set on every connection).
    const db = getDatabase();
    const deleteBothInTransaction = db.transaction((pdfId: string) => {
      deletePageTextForPdf(pdfId);
      deletePdfRow(pdfId);
    });
    deleteBothInTransaction(id);

    // The on-disk file is deleted last and never throws (see storage.ts) —
    // losing the DB record would be worse for the user than an orphaned
    // file, so a filesystem hiccup here must not undo the DB delete above.
    await deleteStoredPdf(record.storedPath);

    return true;
  });

  ipcMain.handle("pdf:open", async (_event, id: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    const record = getPdfById(id);
    assert(!!record, "PDF not found");
    const errorMessage = await shell.openPath(record!.storedPath);
    return errorMessage === "";
  });

  // Returns the raw bytes of a stored PDF so the renderer (pdf.js) can
  // render it. The renderer has no filesystem access itself — this is the
  // only path bytes take out of the main process.
  ipcMain.handle("pdf:getData", async (_event, id: unknown): Promise<Uint8Array> => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    const record = getPdfById(id);
    assert(!!record, "PDF not found");
    if (!fs.existsSync(record!.storedPath)) {
      throw new Error("This PDF's file is missing from storage. Try removing and re-importing it.");
    }
    const buffer = await fs.promises.readFile(record!.storedPath);
    return new Uint8Array(buffer);
  });
}
