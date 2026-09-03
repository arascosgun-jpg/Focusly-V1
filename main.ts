import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { registerPdfHandlers } from "./ipc/pdfHandlers";
import { registerFolderHandlers } from "./ipc/folderHandlers";
import { registerSearchHandlers } from "./ipc/searchHandlers";
import { registerNoteHandlers } from "./ipc/noteHandlers";
import { registerBookmarkHandlers } from "./ipc/bookmarkHandlers";
import { registerProgressHandlers } from "./ipc/progressHandlers";
import { resumePendingIndexing } from "./search/indexer";

// __dirname is available natively since this file compiles to CommonJS.

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Focusly",
    backgroundColor: "#0f1115",
    icon: path.join(__dirname, "../build/icon.png"),
    show: false,
    webPreferences: {
      // Electron security best practices (see project security notes in README).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in the OS browser instead of inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * All IPC handlers are registered here, in the main process, where they can
 * validate every argument coming from the renderer. The renderer never gets
 * direct filesystem/db access — only these narrow, validated channels via
 * the preload bridge (see electron/preload.ts).
 */
function registerIpcHandlers(): void {
  ipcMain.handle("focusly:app-info", async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
    };
  });

  registerPdfHandlers();
  registerFolderHandlers();
  registerSearchHandlers();
  registerNoteHandlers();
  registerBookmarkHandlers();
  registerProgressHandlers();
  resumePendingIndexing();
}

// Safety net: an unexpected rejection anywhere in the main process (e.g. a
// background indexing task) should be logged, not silently swallowed or
// left to crash the process with no diagnostic.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in main process:", reason);
});
