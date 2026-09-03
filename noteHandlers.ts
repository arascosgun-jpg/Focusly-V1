import { ipcMain } from "electron";
import {
  createNote,
  listNotesForPdf,
  updateNote,
  deleteNote,
} from "../db/noteRepository";
import { getPdfById } from "../db/pdfRepository";
import { assert, isNonEmptyString, isNullablePositiveInteger } from "./validate";

export function registerNoteHandlers(): void {
  ipcMain.handle(
    "note:create",
    async (_event, pdfId: unknown, pageNumber: unknown, content: unknown) => {
      assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
      assert(isNullablePositiveInteger(pageNumber), "pageNumber must be a positive integer or null");
      assert(isNonEmptyString(content), "Note content can't be empty");
      assert(!!getPdfById(pdfId), "That PDF no longer exists");
      return createNote(pdfId, pageNumber, content.trim());
    }
  );

  ipcMain.handle("note:listForPdf", async (_event, pdfId: unknown) => {
    assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
    return listNotesForPdf(pdfId);
  });

  ipcMain.handle("note:update", async (_event, id: unknown, content: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    assert(isNonEmptyString(content), "Note content can't be empty");
    const updated = updateNote(id, content.trim());
    assert(!!updated, "That note no longer exists");
    return updated;
  });

  ipcMain.handle("note:delete", async (_event, id: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    deleteNote(id);
    return true;
  });
}
