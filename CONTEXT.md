# Question Bank Overlay Context

## Current Workspace

- Repository root: `C:\Users\josha\OneDrive\Documents\QuestionBankOverlay`
- Active implementation worktree: `C:\Users\josha\OneDrive\Documents\QuestionBankOverlay\.worktrees\extension-mvp`
- Branch: `extension-mvp`
- Plan: `docs/superpowers/plans/2026-07-01-question-bank-overlay-extension.md`
- Spec: `docs/superpowers/specs/2026-07-01-college-board-overlay-extension-design.md`

## Workflow Notes

- The root checkout on `master` contains the design and implementation plan.
- The `extension-mvp` worktree contains the extension implementation.
- Use `npm.cmd` on Windows PowerShell. Plain `npm` resolves to `npm.ps1`, which is blocked by execution policy on this machine.
- Vite/Vitest need to run outside the Codex filesystem sandbox in this environment because esbuild reads parent directories while loading config.

## Progress Log

- 2026-07-01: Prior Codex work completed Task 1, scaffolded the extension, and committed `fc15423 chore: scaffold extension build`.
- 2026-07-01: Baseline verified after switching to `npm.cmd`: `npm.cmd test` passed 1 test file / 2 tests; `npm.cmd run typecheck` passed; `npm.cmd run build` passed, with `content.js` still empty because overlay implementation had not started.
- 2026-07-01: Added shared metadata/note types, privacy-safe sync payloads, question detection, local IndexedDB progress/note storage, and background message routing. Targeted tests passed: 18 tests across shared, detector, storage, and background persistence.
- 2026-07-01: Added overlay UI local mode with tested progress transitions. Targeted content/storage/background tests passed: 16 tests.
- 2026-07-01: Added Supabase RLS migration, Supabase client wrapper, progress/note repositories, and dirty-record sync queue. Sync tests passed: 5 tests.
- 2026-07-01: Added auth message routing and popup sign-in UI for email/password, Google OAuth through `chrome.identity`, and sign-out. Auth/popup tests passed: 5 tests.
- 2026-07-01: Final packaging review found React in the content script caused Vite to emit `content.js` with a top-level shared-chunk import. Replaced the content overlay with a vanilla DOM renderer and verified `dist/assets/content.js` has no top-level import.
- 2026-07-01: Final local verification passed: `npm.cmd test` passed 11 files / 33 tests; `npm.cmd run typecheck` passed; `npm.cmd run build` passed; `dist/manifest.json`, `popup.html`, `assets/background.js`, `assets/content.js`, and `assets/content.css` all exist.

## Review Findings To Address

- The MVP must keep College Board content private: sync only metadata, question keys, and user notes.
- The note-store migration was handled by using IndexedDB version 2 with both stores present.
- The content script is intentionally vanilla DOM so Chrome can load it as a Manifest V3 content script without module syntax.
- Repeat full verification whenever a later agent resumes after code changes: `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
- Manual live QA against College Board and Supabase remains external to this local code pass.
