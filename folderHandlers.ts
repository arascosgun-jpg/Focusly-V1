import { ipcMain } from "electron";
import { createFolder, listFolders, renameFolder, deleteFolder } from "../db/folderRepository";
import { movePdfToFolder } from "../db/pdfRepository";
import { assert, isNonEmptyString, isNullableString } from "./validate";

export function registerFolderHandlers(): void {
  ipcMain.handle("folder:create", async (_event, name: unknown) => {
    assert(isNonEmptyString(name), "name must be a non-empty string");
    return createFolder(name.trim());
  });

  ipcMain.handle("folder:list", async () => {
    return listFolders();
  });

  ipcMain.handle("folder:rename", async (_event, id: unknown, name: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    assert(isNonEmptyString(name), "name must be a non-empty string");
    return renameFolder(id, name.trim());
  });

  ipcMain.handle("folder:delete", async (_event, id: unknown) => {
    assert(isNonEmptyString(id), "id must be a non-empty string");
    deleteFolder(id);
    return true;
  });

  // folderId === null moves the PDF back to the main library.
  ipcMain.handle("folder:movePdf", async (_event, pdfId: unknown, folderId: unknown) => {
    assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
    assert(isNullableString(folderId), "folderId must be a string or null");
    return movePdfToFolder(pdfId, folderId);
  });
}
