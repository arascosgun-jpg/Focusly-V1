export type TextStatus = "pending" | "done" | "failed";

export interface PdfRecord {
  id: string;
  name: string;
  originalPath: string;
  storedPath: string;
  sizeBytes: number;
  importedAt: number;
  folderId: string | null;
  textStatus: TextStatus;
  textError: string | null;
}

export interface FolderRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface NoteRecord {
  id: string;
  pdfId: string;
  pageNumber: number | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkRecord {
  id: string;
  pdfId: string;
  pageNumber: number;
  createdAt: number;
}

export interface ImportPdfResult {
  imported: PdfRecord[];
  skipped: { path: string; reason: string }[];
}

export interface RecentlyStudiedPdf {
  pdfId: string;
  pdfName: string;
  lastStudiedAt: number;
  totalSeconds: number;
}

export interface ProgressSummary {
  pdfsStudied: number;
  totalSessions: number;
  totalSeconds: number;
  lastStudiedAt: number | null;
  recent: RecentlyStudiedPdf[];
}

export interface StorageInfo {
  pdfCount: number;
  totalPdfBytes: number;
  databaseBytes: number;
  storageDirectory: string;
}
