import { ipcMain } from "electron";
import {
  createBookmark,
  listBookmarksForPdf,
  deleteBookmark,
} from "../db/bookmarkRepository";
import { getPdfById } from "../db/pdfRepository";
import { assert, isNonEmptyString, isPositiveInteger } from "./validate";

export function registerBookmarkHandlers(): void {
  ipcMain.handle("bookmark:create", async (_event, pdfId: unknown, pageNumber: unknown) => {
    assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
    assert(isPositiveInteger(pageNumber), "pageNumber must be a positive integer");
    assert(!!getPdfById(pdfId), "That PDF no longer exists");
    return createBookmark(pdfId, pageNumber);
  });

  ipcMain.handle("bookmark:listForPdf", async (_event, pdfId: unknown) => {
    assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
    return listBookmarksForPdf(pdfId);
  });

  ipcMain.handle("bookmark:delete", async (_event, id: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    deleteBookmark(id);
    return true;
  });
}
