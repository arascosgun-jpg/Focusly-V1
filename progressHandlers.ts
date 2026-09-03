import { ipcMain, app } from "electron";
import path from "path";
import fs from "fs";
import { recordSession, getProgressSummary } from "../db/progressRepository";
import { getPdfById } from "../db/pdfRepository";
import { getDatabase } from "../db/database";
import { getPdfStorageDir } from "../pdf/storage";
import { assert, isNonEmptyString, isPositiveInteger } from "./validate";
import type { StorageInfo } from "../types";

export function registerProgressHandlers(): void {
  ipcMain.handle(
    "progress:recordSession",
    async (_event, pdfId: unknown, startedAt: unknown, endedAt: unknown) => {
      assert(isNonEmptyString(pdfId), "pdfId must be a non-empty string");
      assert(isPositiveInteger(startedAt), "startedAt must be a timestamp");
      assert(isPositiveInteger(endedAt), "endedAt must be a timestamp");
      assert(endedAt >= startedAt, "endedAt must not precede startedAt");
      // A session for a PDF that's since been deleted has nowhere to hang
      // (the foreign key would reject it anyway) — drop it quietly.
      if (!getPdfById(pdfId)) return false;
      return recordSession(pdfId, startedAt, endedAt);
    }
  );

  ipcMain.handle("progress:summary", async () => {
    return getProgressSummary();
  });

  ipcMain.handle("storage:info", async (): Promise<StorageInfo> => {
    const db = getDatabase();
    const { pdfCount, totalPdfBytes } = db
      .prepare(
        `SELECT COUNT(*) as pdfCount, COALESCE(SUM(size_bytes), 0) as totalPdfBytes FROM pdfs`
      )
      .get() as { pdfCount: number; totalPdfBytes: number };

    let databaseBytes = 0;
    try {
      databaseBytes = fs.statSync(path.join(app.getPath("userData"), "focusly.db")).size;
    } catch {
      // Database file not readable for size purposes — report 0 rather
      // than failing the whole Settings screen over a cosmetic number.
    }

    return {
      pdfCount,
      totalPdfBytes,
      databaseBytes,
      storageDirectory: getPdfStorageDir(),
    };
  });
}
