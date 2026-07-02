# Question Bank Overlay

A Manifest V3 Chrome extension that overlays private progress tracking and notes on the
College Board SAT Suite Question Bank (`satsuitequestionbank.collegeboard.org`).

Progress and notes are stored locally in IndexedDB and, when you sign in, synced to your own
Supabase project behind row-level security. **Raw question content is never synced** — only
metadata (section/domain/skill/difficulty), a question key, and your own notes leave the device.

## Prerequisites

- Node.js 18+
- A Supabase project (for the optional auth + cross-device sync)
- On Windows PowerShell, use `npm.cmd` (plain `npm` resolves to `npm.ps1`, which is blocked by
  execution policy on some machines).

## Setup

```bash
npm.cmd install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are inlined at **build** time. If they are
missing, the extension still works in local-only mode, but sign-in and sync will throw
`VITE_SUPABASE_URL is required` at runtime. Rebuild after changing them.

## Build & load in Chrome

```bash
npm.cmd run build            # outputs to dist/
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. Open `https://satsuitequestionbank.collegeboard.org/` — the overlay appears top-right.

## Supabase setup

1. Run the migration in `supabase/migrations/202607010001_initial_schema.sql` against your
   project (Supabase SQL editor or `supabase db push`). It creates the tables and per-user
   RLS policies.
2. For Google sign-in, add the extension's OAuth redirect URL in
   **Authentication → URL Configuration**:
   `https://<chrome-extension-id>.chromiumapp.org/supabase`
   (the `<chrome-extension-id>` is shown on the `chrome://extensions` card after loading).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm.cmd test` | Run the Vitest suite |
| `npm.cmd run typecheck` | `tsc --noEmit` type check |
| `npm.cmd run build` | Production build into `dist/` |
| `npm.cmd run dev` | Vite dev server (for iterating on popup UI) |

## Project layout

- `src/content/` — content script: question detection + vanilla-DOM overlay (kept module-free so
  Chrome can load it as an MV3 content script)
- `src/background/` — service worker + message router (owns IndexedDB and sync)
- `src/sync/` — Supabase client, progress/note repositories, dirty-record sync queue
- `src/storage/` — IndexedDB wrapper
- `src/popup/` — React popup for auth
- `supabase/migrations/` — schema + RLS
- `docs/` — design spec, implementation plan, and `docs/qa/manual-mvp-checklist.md`

## Manual QA

See `docs/qa/manual-mvp-checklist.md` for the end-to-end checklist (load, overlay, notes,
auth/sync, and the privacy-boundary inspection steps).
