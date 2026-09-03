export interface Pdf {
  id: string;
  name: string;
  originalPath: string;
  storedPath: string;
  sizeBytes: number;
  importedAt: number;
  folderId: string | null;
  textStatus: "pending" | "done" | "failed";
  textError: string | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Note {
  id: string;
  pdfId: string;
  pageNumber: number | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  pdfId: string;
  pageNumber: number;
  createdAt: number;
}

export interface SmartSearchResult {
  pdfId: string;
  pdfName: string;
  pageNumber: number | null;
  snippet: string | null;
  matchType: "name" | "content";
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
