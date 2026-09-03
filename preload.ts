import { contextBridge, ipcRenderer } from "electron";
import type {
  PdfRecord,
  FolderRecord,
  ImportPdfResult,
  NoteRecord,
  BookmarkRecord,
  ProgressSummary,
  StorageInfo,
} from "./types";
import type { SmartSearchResult } from "./ipc/searchHandlers";

/**
 * The renderer (React app) never talks to Node or Electron internals
 * directly. It only sees this narrow, explicit surface. Every IPC channel
 * registered in electron/ipc/* must be deliberately exposed here too —
 * nothing is exposed by default.
 */
const focuslyApi = {
  getAppInfo: (): Promise<{ name: string; version: string; isPackaged: boolean }> =>
    ipcRenderer.invoke("focusly:app-info"),

  pdf: {
    import: (): Promise<ImportPdfResult> => ipcRenderer.invoke("pdf:import"),
    list: (folderId?: string | null): Promise<PdfRecord[]> =>
      ipcRenderer.invoke("pdf:list", folderId),
    rename: (id: string, name: string): Promise<PdfRecord | null> =>
      ipcRenderer.invoke("pdf:rename", id, name),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("pdf:delete", id),
    open: (id: string): Promise<boolean> => ipcRenderer.invoke("pdf:open", id),
    getData: (id: string): Promise<Uint8Array> => ipcRenderer.invoke("pdf:getData", id),
  },

  folder: {
    create: (name: string): Promise<FolderRecord> => ipcRenderer.invoke("folder:create", name),
    list: (): Promise<FolderRecord[]> => ipcRenderer.invoke("folder:list"),
    rename: (id: string, name: string): Promise<FolderRecord | null> =>
      ipcRenderer.invoke("folder:rename", id, name),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("folder:delete", id),
    movePdf: (pdfId: string, folderId: string | null): Promise<PdfRecord | null> =>
      ipcRenderer.invoke("folder:movePdf", pdfId, folderId),
  },

  search: {
    smart: (query: string): Promise<SmartSearchResult[]> =>
      ipcRenderer.invoke("search:smart", query),
    reindex: (pdfId: string): Promise<boolean> => ipcRenderer.invoke("search:reindex", pdfId),
  },

  note: {
    create: (pdfId: string, pageNumber: number | null, content: string): Promise<NoteRecord> =>
      ipcRenderer.invoke("note:create", pdfId, pageNumber, content),
    listForPdf: (pdfId: string): Promise<NoteRecord[]> =>
      ipcRenderer.invoke("note:listForPdf", pdfId),
    update: (id: string, content: string): Promise<NoteRecord> =>
      ipcRenderer.invoke("note:update", id, content),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("note:delete", id),
  },

  bookmark: {
    create: (pdfId: string, pageNumber: number): Promise<BookmarkRecord> =>
      ipcRenderer.invoke("bookmark:create", pdfId, pageNumber),
    listForPdf: (pdfId: string): Promise<BookmarkRecord[]> =>
      ipcRenderer.invoke("bookmark:listForPdf", pdfId),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke("bookmark:delete", id),
  },

  progress: {
    recordSession: (pdfId: string, startedAt: number, endedAt: number): Promise<boolean> =>
      ipcRenderer.invoke("progress:recordSession", pdfId, startedAt, endedAt),
    summary: (): Promise<ProgressSummary> => ipcRenderer.invoke("progress:summary"),
  },

  storage: {
    info: (): Promise<StorageInfo> => ipcRenderer.invoke("storage:info"),
  },
};

contextBridge.exposeInMainWorld("focusly", focuslyApi);

export type FocuslyApi = typeof focuslyApi;
