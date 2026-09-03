import { randomUUID } from "crypto";
import { getDatabase } from "./database";
import type { ProgressSummary, RecentlyStudiedPdf } from "../types";

/**
 * Records a completed study session. Sessions shorter than this are
 * discarded: opening a PDF, glancing at it, and closing it isn't studying,
 * and counting it would make the Progress numbers meaningless.
 */
const MINIMUM_SESSION_SECONDS = 30;

export function recordSession(
  pdfId: string,
  startedAt: number,
  endedAt: number
): boolean {
  const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
  if (durationSeconds < MINIMUM_SESSION_SECONDS) return false;

  const db = getDatabase();
  db.prepare(
    `INSERT INTO study_sessions (id, pdf_id, started_at, ended_at, duration_seconds)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), pdfId, startedAt, endedAt, durationSeconds);
  return true;
}

export function getProgressSummary(recentLimit = 8): ProgressSummary {
  const db = getDatabase();

  const totals = db
    .prepare(
      `SELECT COUNT(DISTINCT pdf_id) as pdfsStudied,
              COUNT(*) as totalSessions,
              COALESCE(SUM(duration_seconds), 0) as totalSeconds,
              MAX(ended_at) as lastStudiedAt
       FROM study_sessions`
    )
    .get() as {
    pdfsStudied: number;
    totalSessions: number;
    totalSeconds: number;
    lastStudiedAt: number | null;
  };

  const recent = db
    .prepare(
      `SELECT s.pdf_id as pdfId,
              p.name as pdfName,
              MAX(s.ended_at) as lastStudiedAt,
              SUM(s.duration_seconds) as totalSeconds
       FROM study_sessions s
       JOIN pdfs p ON p.id = s.pdf_id
       GROUP BY s.pdf_id
       ORDER BY lastStudiedAt DESC
       LIMIT ?`
    )
    .all(recentLimit) as RecentlyStudiedPdf[];

  return {
    pdfsStudied: totals.pdfsStudied,
    totalSessions: totals.totalSessions,
    totalSeconds: totals.totalSeconds,
    lastStudiedAt: totals.lastStudiedAt,
    recent,
  };
}
