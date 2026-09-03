# Focusly

**A simple, modern PDF study companion for Windows.** Store your study
PDFs, organize them into folders, read them, search inside them, take
notes, bookmark important pages, and keep track of your study time.

Everything runs locally on your computer. No account, no network, no AI.

```
IMPORT → ORGANIZE → READ → SEARCH → NOTE → BOOKMARK → TRACK
```

Built with Electron, React, TypeScript, and Vite.

## Features

**Library** — Import PDFs through the native Windows file picker. Focusly
copies each file into its own storage; **your original files are never
modified or moved.** See every PDF with its name, size, and import date.
Rename, delete, or open any of them. Duplicate imports, empty files, and
files that aren't really PDFs are detected and skipped with a clear reason.

**Folders** — Create, rename, and delete folders (Nursing, Anatomy, Exams,
whatever fits). Move PDFs into a folder, between folders, or back to the
main library. **Deleting a folder never deletes the PDFs inside it** — they
return to the main library.

**PDF Viewer** — Opens inside Focusly. Page navigation, jump straight to a
page number, zoom in and out, current page and total page count always
visible. Corrupted or missing files produce a clear message instead of a
crash.

**Notes** — Write notes attached to a specific page of a PDF. Edit them,
delete them, and click any note's page number to jump straight there.
Notes persist between sessions and are removed automatically when their
PDF is deleted.

**Bookmarks** — Bookmark any page with one click (the same button removes
it). Jump to any bookmarked page from the list. The same page can't be
bookmarked twice.

**Smart Search** — One search box in the Library matches PDF **filenames**
and searches inside **extracted PDF text**. Content matches show a
highlighted snippet and the page number; clicking one opens the PDF right
on that page. Text is extracted in the background on import — a small
status dot on each row shows progress.

**Progress** — A deliberately simple summary: total study time, number of
study sessions, PDFs studied, last study date, and your recently studied
PDFs. A session is recorded when you close a PDF you had open for at least
30 seconds, so quick glances don't inflate the numbers.

**Settings** — Light / dark / system theme (remembered between launches),
storage usage and location, data management notes, privacy information,
and the app version.

## Installation

Download `Focusly Setup <version>.exe` from the project's Releases page (or
from the GitHub Actions build artifact), run it, and follow the installer.
You can choose the install location, and shortcuts are created on your
Desktop and in the Start Menu.

Focusly stores its data in your Windows user profile under
`%APPDATA%\Focusly` — the exact path is shown in Settings → Storage.

## Building from source

Requires **Node.js 20 or newer**.

```bash
npm install                 # also rebuilds native modules for Electron
npm run typecheck           # TypeScript check, both renderer and main process
npm run build:win           # produces the NSIS installer in release/
```

To run it in development, in two terminals:

```bash
npm run dev                 # Vite dev server on http://localhost:5173
npm run dev:electron        # compiles main/preload, launches Electron
```

## GitHub Actions

The `Build Windows Installer` workflow runs on `windows-latest` on every
push to `main`, on pull requests, and on manual dispatch. It verifies the
build assets exist, installs dependencies, type-checks, builds the
installer with electron-builder, and uploads `release/*.exe` as the
`focusly-windows-installer` artifact. On failure it uploads build
diagnostics instead.

## Architecture

```
focusly/
├── build/
│   ├── icon.ico            # Windows installer + executable icon
│   └── icon.png            # Runtime window icon
├── electron/               # Main process — the only place with Node access
│   ├── db/
│   │   ├── database.ts     # SQLite bootstrap, schema, migrations, recovery
│   │   ├── pdfRepository.ts
│   │   ├── folderRepository.ts
│   │   ├── noteRepository.ts
│   │   ├── bookmarkRepository.ts
│   │   ├── progressRepository.ts
│   │   └── pageTextRepository.ts   # FTS5 full-text search
│   ├── ipc/                # One handler module per domain; all validate input
│   │   ├── validate.ts
│   │   ├── pdfHandlers.ts
│   │   ├── folderHandlers.ts
│   │   ├── noteHandlers.ts
│   │   ├── bookmarkHandlers.ts
│   │   ├── progressHandlers.ts
│   │   └── searchHandlers.ts
│   ├── pdf/storage.ts      # Copies PDFs into app-managed storage
│   ├── search/
│   │   ├── textExtraction.ts
│   │   └── indexer.ts
│   ├── main.ts
│   ├── preload.ts          # The entire renderer-facing API surface
│   └── types.ts
└── src/                    # Renderer — no Node access at all
    ├── components/Sidebar.tsx
    ├── screens/
    │   ├── Library.tsx
    │   ├── Folders.tsx
    │   ├── PdfViewer.tsx   # Also hosts Notes and Bookmarks panels
    │   ├── Progress.tsx
    │   └── Settings.tsx
    ├── styles/global.css
    ├── types/
    ├── App.tsx
    └── main.tsx
```

**Security.** `contextIsolation` is enabled, `nodeIntegration` is disabled,
and `sandbox` is on. The renderer reaches the main process only through the
explicit, typed `window.focusly` bridge in `preload.ts` — nothing is exposed
by default. Every IPC handler validates its arguments before touching the
filesystem or database. PDF bytes reach the viewer through a dedicated
`pdf:getData` channel rather than any `file://` access.

**Data safety.** Deleting a PDF removes its search index rows and its
database row inside a single transaction; notes, bookmarks, and study
sessions cascade automatically via foreign keys. The on-disk file is
deleted last and its failures are logged rather than thrown, so a
filesystem hiccup can never roll back a successful database delete. A
failed import cleans up any partial copy and leaves no database record. If
the database file is ever unreadable, Focusly moves it aside, tells you
where it went, and starts fresh instead of refusing to launch.

## Troubleshooting

### `npm error code E403 — 403 Forbidden` from registry.npmjs.org

This is **not** a problem with `package.json` or any specific dependency,
even though npm names one package in the error (it just reports whichever
request failed first — the name varies between runs).

`403 Forbidden` means something between you and npm refused the request.
The packages themselves are fine and public. To confirm, try fetching any
well-known package directly:

```bash
curl -I https://registry.npmjs.org/react
```

If that also returns 403, the block is environmental, not a dependency
issue. Common causes:

- A corporate proxy, firewall, or VPN intercepting npm traffic.
- A CI runner or container with no outbound network access, or an egress
  allowlist that doesn't include `registry.npmjs.org`.
- An `.npmrc` (project, user `~/.npmrc`, or global) pointing at a private
  registry that rejects unauthenticated requests, or holding a stale auth
  token. Check with:

```bash
npm config get registry     # should be https://registry.npmjs.org/
npm config list             # shows which .npmrc files are in effect
```

This project deliberately ships **no `.npmrc`**, so npm uses the public
registry by default. Adding one is only necessary if you *want* a mirror.

**Do not "fix" this by removing dependencies.** In particular,
`@types/better-sqlite3` is required — see below.

### Why `@types/better-sqlite3` can't be removed

`better-sqlite3` is a JavaScript package and ships **no bundled TypeScript
declarations**; its maintainers state that type definitions are provided by
the community at `@types/better-sqlite3` and that the package has no
official TypeScript support. (This is unlike `sqlite3`, which does bundle
its own types.)

`electron/db/database.ts` uses the namespace types from that package
directly (`Database.Database`), so removing it produces:

```
error TS7016: Could not find a declaration file for module 'better-sqlite3'.
```

If you ever do need to drop it, the only correct alternatives are writing
and maintaining your own `.d.ts` for the parts of the API used here, or
switching to a SQLite library that bundles its own types — not deleting the
types package and leaving the imports untyped.

## Known limitations

These are honest gaps in v1, not hidden bugs:

- **No real build or runtime test has been performed on this code.** It was
  developed in a sandboxed environment with no network access, so
  `npm install` could never run — meaning `npm run typecheck`,
  `npm run build`, and `npm run build:win` have **not** been executed, and
  the app has never actually been launched. Verification here was static
  only: full code review, brace/paren balance checks across all 31 source
  files, relative-import resolution checks, CSS class coverage, and JSON/
  YAML validation. **Treat your first local `npm install && npm run
  typecheck && npm run build:win` as the real test.** Expect to fix at
  least a small issue or two — particularly around `pdfjs-dist`'s exact
  export paths, which vary between minor versions.
- **No `package-lock.json` is committed** (it can't be generated without
  network access). CI uses `npm install`. After your first local install,
  commit the lockfile and switch CI to `npm ci` plus `cache: npm`.
- **PDF text extraction runs on the main process's event loop**, not a
  worker thread. File copying and disk I/O are async, but CPU-bound page
  parsing of a very large PDF may briefly add latency elsewhere. Extraction
  is serialized one PDF at a time and resumes on next launch if interrupted.
- **Scanned/image-only PDFs won't be content-searchable.** Focusly reads the
  text layer; it has no OCR. Filename search still works for these.
- **The viewer renders one page at a time** at the current zoom. This keeps
  memory flat and is fine for typical study material, but there's no
  continuous-scroll or thumbnail sidebar.
- **Study sessions are per-viewer-visit**, measured from opening a PDF to
  closing the viewer. Focusly doesn't detect whether you walked away from
  your desk, so leaving a PDF open inflates that session's time.
- **Deleting a PDF permanently deletes its notes and bookmarks**, with a
  confirmation prompt but no undo and no export.
- **The theme is stored per-installation in the renderer**, not in the
  database. Clearing app data resets it to "system".
- **Windows only.** The Electron code is largely cross-platform, but only
  the Windows build target is configured and nothing has been tested
  elsewhere.
- **The installer is unsigned.** Windows SmartScreen will warn on first run
  until you add code signing.
