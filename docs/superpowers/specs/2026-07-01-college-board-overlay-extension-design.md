# College Board Overlay Extension Design

Date: 2026-07-01

## Goal

Build a Chrome extension that makes the College Board Question Bank easier to study from while users remain on College Board's own interface. The extension adds an overlay for progress tracking, private notes, review status, saved workflow metadata, and cross-device sync.

The product must not scrape or republish College Board's question bank. It should sync user-owned study metadata, not full question text, answer choices, explanations, images, or PDFs.

## Product Boundary

In scope:

- Overlay UI on supported College Board Question Bank pages.
- Per-question study status: unseen, done, correct, missed, unsure, review.
- Private synced notes.
- Cross-device account sync.
- Local cache for responsiveness and offline fallback.
- Saved filter presets when the page exposes enough stable filter state.
- Basic session progress counts.

Out of scope for MVP:

- Public question database.
- Bulk scraping or bulk downloading.
- Hidden College Board API calls.
- Uploading or syncing College Board PDFs.
- Sharing notes, question sets, or imported materials publicly.
- AI training on user notes or imported materials.
- Automated end-to-end tests against the live College Board site.

## Architecture

The system has five main parts:

- Chrome extension content script: runs on allowed College Board Question Bank URLs and injects the overlay.
- Overlay UI: side panel for status, notes, session progress, and quick actions.
- Question detector: identifies the current question using a visible official ID if available, otherwise a local browser-computed fingerprint.
- Supabase backend: provides email/password auth, Google sign-in, Postgres storage, and row-level security.
- Local cache: stores recent progress and pending sync operations in browser storage or IndexedDB.

A minimal hosted web app may be used for auth callback handling, account settings, and later dashboard views.

## Overlay Workflow

When a user opens a supported College Board Question Bank page, the extension adds a compact side panel. For the current visible question, the panel shows:

- Current status: unseen, done, correct, missed, unsure, or review.
- Quick actions: correct, missed, unsure, review, clear.
- Private notes box.
- First seen, last seen, and attempt count.
- Skill, domain, section, and difficulty when visible on the page.
- Sync state: saved, saving, offline, sync delayed, or needs sign-in.

The study loop:

1. User filters and navigates on College Board as usual.
2. Extension detects the current question.
3. If the question was seen before, previous status and notes load.
4. User answers in College Board's interface.
5. User marks the result in the overlay.
6. Extension writes locally immediately.
7. If signed in, extension syncs metadata to Supabase.
8. Other devices restore the same metadata when the user signs in and reaches the same question.

## Data Model

Store study metadata and private notes only.

### profiles

- id
- email
- display_name
- created_at

### question_progress

- id
- user_id
- source
- question_key
- question_key_method
- section
- domain
- skill
- difficulty
- status
- last_result
- attempt_count
- first_seen_at
- last_seen_at
- updated_at

### question_notes

- id
- user_id
- question_key
- note
- created_at
- updated_at

### filter_presets

- id
- user_id
- name
- source
- filters_json
- created_at
- updated_at

### study_sessions

- id
- user_id
- source
- started_at
- ended_at
- seen_count
- correct_count
- missed_count
- unsure_count
- review_count

The canonical key is `user_id + source + question_key`. `question_key` should come from a visible official question ID when available. If no stable ID is visible, the content script computes a local fingerprint and syncs only the resulting hash.

## Sync And Privacy

- Users can sign in with email/password or Google.
- Supabase row-level security must protect every user-owned table.
- Users can read and write only their own records.
- Notes are private user content.
- Notes are not public, shareable, or used for AI training in MVP.
- Notes should have a practical limit, such as 2,000 characters.
- The UI should warn users not to paste full copyrighted question text into notes.
- Sync payloads must exclude raw question text, answer choices, explanations, images, and PDF content.

## Error Handling

- Not signed in: local-only mode remains available, with a sign-in prompt for sync.
- Offline: save locally, queue sync, and retry when online.
- Supabase error: keep local changes, show sync delayed, and retry in the background.
- Question not detected: disable status and note controls and show a clear unsupported-page message.
- Unstable fingerprint: do not create unreliable progress records.
- College Board layout changes: fail closed by disabling detector-dependent controls instead of guessing.
- Duplicate keys: merge by user and question key; avoid silently overwriting newer notes.
- Auth expires: keep local mode active and prompt re-login.
- Multi-device note conflicts: use last-write-wins for MVP.

## Testing Plan

Unit tests:

- Question detector extracts visible metadata from mocked College Board page HTML.
- Fingerprint generation is stable across harmless DOM changes.
- Progress status transitions work correctly.
- Note length validation works.
- Sync payload generation excludes raw question text.

Integration tests:

- Content script injects overlay only on allowed College Board URLs.
- Overlay loads previous progress for a detected question.
- Marking correct, missed, unsure, or review updates the local cache.
- Local cache syncs to Supabase when signed in.
- Offline changes queue and later sync.
- Auth expiration falls back to local mode.

Backend tests:

- Row-level security prevents cross-user reads and writes.
- Progress upsert works by user and question key.
- Notes are private and length-limited.
- Filter presets are user-scoped.
- Session counters update correctly.

Manual QA:

- Sign in with email/password.
- Sign in with Google.
- Use overlay on a supported College Board Question Bank page.
- Mark a question, refresh, and confirm state persists.
- Sign in on a second browser or device and confirm sync.
- Test offline mode.
- Confirm the extension does not store or export full question content.

## MVP Implementation Defaults

- URL permissions should be narrow and explicit. The implementation plan must confirm the current Student Question Bank host and include only that host in `host_permissions`; no broad `*://*.collegeboard.org/*` permission.
- Local cache should use IndexedDB. A small wrapper library is acceptable if it keeps sync and migration code simpler.
- The hosted auth/settings page should live in the same repository as the extension for MVP.
- Saved filter presets are included only after core progress tracking, notes, auth, and sync are working.
- Educator-only pages are out of scope for MVP unless the user explicitly adds them later.
