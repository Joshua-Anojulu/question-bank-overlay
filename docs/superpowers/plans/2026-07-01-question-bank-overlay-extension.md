# Question Bank Overlay Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP Chrome extension that overlays progress tracking and private synced notes on the College Board Question Bank interface.

**Architecture:** The extension uses Manifest V3, a React overlay content script, a background service worker that owns IndexedDB and Supabase sync, and a popup for auth/account state. The content script never sends raw question text to the backend; it sends detected metadata and a question key only.

**Tech Stack:** TypeScript, React, Vite, Vitest, Chrome Extension Manifest V3, IndexedDB via `idb`, Supabase Auth/Postgres, Supabase row-level security.

---

## File Structure

Create this structure:

```txt
package.json
vite.config.ts
tsconfig.json
vitest.config.ts
public/manifest.json
popup.html
src/background/serviceWorker.ts
src/background/messageRouter.ts
src/config/env.ts
src/config/supportedHosts.ts
src/content/main.tsx
src/content/questionDetector.ts
src/content/OverlayRoot.tsx
src/content/overlay.css
src/popup/main.tsx
src/popup/Popup.tsx
src/shared/types.ts
src/shared/noteValidation.ts
src/shared/syncPayload.ts
src/storage/localDb.ts
src/sync/supabaseClient.ts
src/sync/progressRepository.ts
src/sync/syncQueue.ts
supabase/migrations/202607010001_initial_schema.sql
tests/setup.ts
tests/shared/noteValidation.test.ts
tests/shared/syncPayload.test.ts
tests/content/questionDetector.test.ts
tests/storage/localDb.test.ts
tests/background/messageRouter.test.ts
tests/sync/progressRepository.test.ts
docs/qa/manual-mvp-checklist.md
```

Boundary rules for every task:

- Do not call hidden College Board APIs.
- Do not bulk-download, bulk-export, or scrape question content.
- Do not sync raw question text, answer choices, explanations, images, or PDFs.
- Use the narrow College Board host permission in `public/manifest.json`.
- Keep educator-only pages outside the MVP.

---

### Task 1: Scaffold Extension Build And Test Harness

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `public/manifest.json`
- Create: `popup.html`
- Create: `src/background/serviceWorker.ts`
- Create: `src/config/supportedHosts.ts`
- Test: `tests/background/messageRouter.test.ts`

- [ ] **Step 1: Write a failing manifest smoke test**

Create `tests/background/messageRouter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import manifest from '../../public/manifest.json';

describe('extension manifest', () => {
  it('uses narrow College Board host permissions', () => {
    expect(manifest.host_permissions).toContain('https://satsuitequestionbank.collegeboard.org/*');
    expect(manifest.host_permissions).not.toContain('*://*.collegeboard.org/*');
  });

  it('runs as a Manifest V3 extension', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(['storage', 'identity']));
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/background/messageRouter.test.ts`

Expected: the command fails because `package.json` and Vitest do not exist yet.

- [ ] **Step 3: Add the project scaffold**

Create `package.json`:

```json
{
  "name": "question-bank-overlay",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "idb": "^8.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        content: resolve(__dirname, 'src/content/main.tsx'),
        background: resolve(__dirname, 'src/background/serviceWorker.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true
  }
});
```

Create `tests/setup.ts`:

```ts
import 'fake-indexeddb/auto';
```

Create `src/config/supportedHosts.ts`:

```ts
export const COLLEGE_BOARD_QUESTION_BANK_MATCH = 'https://satsuitequestionbank.collegeboard.org/*';
export const COLLEGE_BOARD_QUESTION_BANK_HOST = 'satsuitequestionbank.collegeboard.org';
```

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Question Bank Overlay",
  "description": "Private progress tracking and notes for the College Board Question Bank.",
  "version": "0.1.0",
  "permissions": ["storage", "identity"],
  "host_permissions": [
    "https://satsuitequestionbank.collegeboard.org/*",
    "https://*.supabase.co/*"
  ],
  "background": { "service_worker": "assets/background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["https://satsuitequestionbank.collegeboard.org/*"],
      "js": ["assets/content.js"],
      "css": ["assets/content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": { "default_popup": "popup.html", "default_title": "Question Bank Overlay" }
}
```

Create `popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Question Bank Overlay</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

Create `src/background/serviceWorker.ts`:

```ts
chrome.runtime.onInstalled.addListener(() => {
  console.info('Question Bank Overlay installed');
});
```

Run: `npm install`

Expected: `package-lock.json` and `node_modules` are created.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/background/messageRouter.test.ts`

Expected: PASS for both manifest tests.

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json vitest.config.ts tests/setup.ts public/manifest.json popup.html src/background/serviceWorker.ts src/config/supportedHosts.ts tests/background/messageRouter.test.ts
git commit -m "chore: scaffold extension build"
```

---

### Task 2: Add Shared Types, Note Validation, And Safe Sync Payloads

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/noteValidation.ts`
- Create: `src/shared/syncPayload.ts`
- Test: `tests/shared/noteValidation.test.ts`
- Test: `tests/shared/syncPayload.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `tests/shared/noteValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_NOTE_LENGTH, validateNote } from '../../src/shared/noteValidation';

describe('validateNote', () => {
  it('accepts short private notes', () => {
    expect(validateNote('Review percent change trap.')).toEqual({ ok: true, value: 'Review percent change trap.' });
  });

  it('rejects notes over the maximum length', () => {
    const longNote = 'x'.repeat(MAX_NOTE_LENGTH + 1);
    expect(validateNote(longNote)).toEqual({ ok: false, reason: 'NOTE_TOO_LONG' });
  });
});
```

Create `tests/shared/syncPayload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toProgressPayload } from '../../src/shared/syncPayload';
import type { QuestionProgress } from '../../src/shared/types';

describe('toProgressPayload', () => {
  it('excludes raw prompt and answer content', () => {
    const progress: QuestionProgress & { promptText?: string; answerChoices?: string[] } = {
      source: 'college-board-question-bank',
      questionKey: 'hash_123',
      questionKeyMethod: 'fingerprint',
      section: 'Math',
      domain: 'Algebra',
      skill: 'Linear equations',
      difficulty: 'Hard',
      status: 'missed',
      lastResult: 'missed',
      attemptCount: 2,
      firstSeenAt: '2026-07-01T10:00:00.000Z',
      lastSeenAt: '2026-07-01T10:05:00.000Z',
      updatedAt: '2026-07-01T10:05:00.000Z',
      promptText: 'A copied prompt must never be synced.',
      answerChoices: ['A', 'B', 'C', 'D']
    };

    const payload = toProgressPayload('user_1', progress);

    expect(JSON.stringify(payload)).not.toContain('copied prompt');
    expect(JSON.stringify(payload)).not.toContain('answerChoices');
    expect(payload).toMatchObject({ user_id: 'user_1', question_key: 'hash_123', status: 'missed' });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/shared/noteValidation.test.ts tests/shared/syncPayload.test.ts`

Expected: FAIL because the shared modules do not exist.

- [ ] **Step 3: Add shared modules**

Create `src/shared/types.ts`:

```ts
export type QuestionSource = 'college-board-question-bank';
export type QuestionKeyMethod = 'visible-id' | 'fingerprint';
export type StudyStatus = 'unseen' | 'done' | 'correct' | 'missed' | 'unsure' | 'review';
export type LastResult = 'correct' | 'missed' | 'unsure' | null;
export type SyncState = 'saved' | 'saving' | 'offline' | 'sync-delayed' | 'needs-sign-in';

export interface QuestionMetadata {
  source: QuestionSource;
  questionKey: string;
  questionKeyMethod: QuestionKeyMethod;
  section: string | null;
  domain: string | null;
  skill: string | null;
  difficulty: string | null;
}

export interface QuestionProgress extends QuestionMetadata {
  status: StudyStatus;
  lastResult: LastResult;
  attemptCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface QuestionNote {
  source: QuestionSource;
  questionKey: string;
  note: string;
  updatedAt: string;
}

export interface ProgressPayload {
  user_id: string;
  source: QuestionSource;
  question_key: string;
  question_key_method: QuestionKeyMethod;
  section: string | null;
  domain: string | null;
  skill: string | null;
  difficulty: string | null;
  status: StudyStatus;
  last_result: LastResult;
  attempt_count: number;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
}
```

Create `src/shared/noteValidation.ts`:

```ts
export const MAX_NOTE_LENGTH = 2000;

export type NoteValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'NOTE_TOO_LONG' };

export function validateNote(note: string): NoteValidationResult {
  const normalized = note.replace(/\r\n/g, '\n').trim();

  if (normalized.length > MAX_NOTE_LENGTH) {
    return { ok: false, reason: 'NOTE_TOO_LONG' };
  }

  return { ok: true, value: normalized };
}
```

Create `src/shared/syncPayload.ts`:

```ts
import type { ProgressPayload, QuestionProgress } from './types';

export function toProgressPayload(userId: string, progress: QuestionProgress): ProgressPayload {
  return {
    user_id: userId,
    source: progress.source,
    question_key: progress.questionKey,
    question_key_method: progress.questionKeyMethod,
    section: progress.section,
    domain: progress.domain,
    skill: progress.skill,
    difficulty: progress.difficulty,
    status: progress.status,
    last_result: progress.lastResult,
    attempt_count: progress.attemptCount,
    first_seen_at: progress.firstSeenAt,
    last_seen_at: progress.lastSeenAt,
    updated_at: progress.updatedAt
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/shared/noteValidation.test.ts tests/shared/syncPayload.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/shared
git commit -m "feat: add shared progress types"
```

---

### Task 3: Add Question Detection With Local Fingerprints

**Files:**
- Create: `src/content/questionDetector.ts`
- Test: `tests/content/questionDetector.test.ts`

- [ ] **Step 1: Write failing detector tests**

Create `tests/content/questionDetector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectQuestion } from '../../src/content/questionDetector';

describe('detectQuestion', () => {
  it('prefers a visible question id when present', async () => {
    document.body.innerHTML = `
      <main><article data-question-id="cb-12345">
        <h2>Question ID: cb-12345</h2>
        <p>Which expression is equivalent to 2x + 4?</p>
        <span>Domain: Algebra</span><span>Skill: Linear equations</span><span>Difficulty: Hard</span>
      </article></main>`;

    await expect(detectQuestion(document)).resolves.toMatchObject({
      questionKey: 'cb-12345',
      questionKeyMethod: 'visible-id',
      domain: 'Algebra',
      skill: 'Linear equations',
      difficulty: 'Hard'
    });
  });

  it('uses a local fingerprint when no visible id exists', async () => {
    document.body.innerHTML = `
      <main><article>
        <p>A student solves a linear equation and makes a sign error. Which step first shows the error?</p>
        <ol><li>Choice A</li><li>Choice B</li><li>Choice C</li><li>Choice D</li></ol>
      </article></main>`;

    const detected = await detectQuestion(document);
    expect(detected?.questionKeyMethod).toBe('fingerprint');
    expect(detected?.questionKey).toMatch(/^sha256_/);
  });

  it('returns null when the page has too little visible question content', async () => {
    document.body.innerHTML = '<main><p>Loading</p></main>';
    await expect(detectQuestion(document)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- tests/content/questionDetector.test.ts`

Expected: FAIL because `questionDetector.ts` does not exist.

- [ ] **Step 3: Implement the detector**

Create `src/content/questionDetector.ts`:

```ts
import type { QuestionMetadata } from '../shared/types';

const SOURCE = 'college-board-question-bank' as const;
const MIN_FINGERPRINT_TEXT_LENGTH = 80;
const QUESTION_SELECTORS = ['[data-question-id]', '[data-testid*="question" i]', 'article', 'main'];

export async function detectQuestion(root: Document): Promise<QuestionMetadata | null> {
  const container = findQuestionContainer(root);
  if (!container) return null;

  const visibleId = getVisibleQuestionId(container);
  const section = findLabeledValue(container, 'Section');
  const domain = findLabeledValue(container, 'Domain');
  const skill = findLabeledValue(container, 'Skill');
  const difficulty = findLabeledValue(container, 'Difficulty');

  if (visibleId) {
    return { source: SOURCE, questionKey: visibleId, questionKeyMethod: 'visible-id', section, domain, skill, difficulty };
  }

  const normalizedText = normalizeVisibleText(container.textContent ?? '');
  if (normalizedText.length < MIN_FINGERPRINT_TEXT_LENGTH) return null;

  return {
    source: SOURCE,
    questionKey: `sha256_${await sha256(normalizedText.slice(0, 5000))}`,
    questionKeyMethod: 'fingerprint',
    section,
    domain,
    skill,
    difficulty
  };
}

function findQuestionContainer(root: Document): Element | null {
  for (const selector of QUESTION_SELECTORS) {
    const match = root.querySelector(selector);
    if (match && normalizeVisibleText(match.textContent ?? '').length >= 1) return match;
  }
  return null;
}

function getVisibleQuestionId(container: Element): string | null {
  const dataId = container.getAttribute('data-question-id');
  if (dataId && dataId.trim()) return dataId.trim();
  const match = normalizeVisibleText(container.textContent ?? '').match(/Question ID:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function findLabeledValue(container: Element, label: string): string | null {
  const text = normalizeVisibleText(container.textContent ?? '');
  const pattern = new RegExp(`${label}:\\s*([^|\\n]+?)(?=\\s+(Section|Domain|Skill|Difficulty):|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/content/questionDetector.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/questionDetector.ts tests/content/questionDetector.test.ts
git commit -m "feat: detect current question metadata"
```

---

### Task 4: Add Local IndexedDB Storage Owned By The Extension

**Files:**
- Create: `src/storage/localDb.ts`
- Test: `tests/storage/localDb.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `tests/storage/localDb.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocalDb, getLocalProgress, upsertLocalProgress } from '../../src/storage/localDb';
import type { QuestionProgress } from '../../src/shared/types';

const baseProgress: QuestionProgress = {
  source: 'college-board-question-bank',
  questionKey: 'sha256_abc',
  questionKeyMethod: 'fingerprint',
  section: 'Math',
  domain: 'Algebra',
  skill: 'Linear equations',
  difficulty: 'Hard',
  status: 'correct',
  lastResult: 'correct',
  attemptCount: 1,
  firstSeenAt: '2026-07-01T10:00:00.000Z',
  lastSeenAt: '2026-07-01T10:01:00.000Z',
  updatedAt: '2026-07-01T10:01:00.000Z'
};

describe('localDb', () => {
  beforeEach(async () => await clearLocalDb());

  it('stores and reads progress by source and question key', async () => {
    await upsertLocalProgress(baseProgress);
    await expect(getLocalProgress('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({ status: 'correct' });
  });

  it('keeps the newest record by updatedAt', async () => {
    await upsertLocalProgress({ ...baseProgress, status: 'missed', updatedAt: '2026-07-01T10:02:00.000Z' });
    await upsertLocalProgress({ ...baseProgress, status: 'correct', updatedAt: '2026-07-01T10:01:00.000Z' });
    await expect(getLocalProgress('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({ status: 'missed' });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/storage/localDb.test.ts`

Expected: FAIL because `localDb.ts` does not exist.

- [ ] **Step 3: Implement IndexedDB storage**

Create `src/storage/localDb.ts`:

```ts
import { openDB, type DBSchema } from 'idb';
import type { QuestionProgress, QuestionSource } from '../shared/types';

interface StoredProgress extends QuestionProgress { localKey: string; dirty: boolean }
interface OverlayDb extends DBSchema { progress: { key: string; value: StoredProgress } }

const DB_NAME = 'question-bank-overlay';
const DB_VERSION = 1;

export async function upsertLocalProgress(progress: QuestionProgress): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(progress.source, progress.questionKey);
  const existing = await db.get('progress', localKey);
  if (existing && existing.updatedAt > progress.updatedAt) return;
  await db.put('progress', { ...progress, localKey, dirty: true });
}

export async function getLocalProgress(source: QuestionSource, questionKey: string): Promise<QuestionProgress | null> {
  const db = await getDb();
  const record = await db.get('progress', makeLocalKey(source, questionKey));
  if (!record) return null;
  const { localKey: _localKey, dirty: _dirty, ...progress } = record;
  return progress;
}

export async function listDirtyProgress(): Promise<QuestionProgress[]> {
  const db = await getDb();
  const all = await db.getAll('progress');
  return all.filter((record) => record.dirty).map(({ localKey: _localKey, dirty: _dirty, ...progress }) => progress);
}

export async function markProgressSynced(source: QuestionSource, questionKey: string): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(source, questionKey);
  const record = await db.get('progress', localKey);
  if (record) await db.put('progress', { ...record, dirty: false });
}

export async function clearLocalDb(): Promise<void> {
  const db = await getDb();
  await db.clear('progress');
}

function makeLocalKey(source: QuestionSource, questionKey: string): string {
  return `${source}:${questionKey}`;
}

function getDb() {
  return openDB<OverlayDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'localKey' });
    }
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/storage/localDb.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/localDb.ts tests/storage/localDb.test.ts
git commit -m "feat: add local progress cache"
```

---

### Task 5: Add Background Message Router For Overlay Persistence

**Files:**
- Create: `src/background/messageRouter.ts`
- Modify: `src/background/serviceWorker.ts`
- Test: `tests/background/messageRouter.test.ts`

- [ ] **Step 1: Extend router tests**

Replace `tests/background/messageRouter.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';
import manifest from '../../public/manifest.json';
import { handleMessage } from '../../src/background/messageRouter';
import type { QuestionProgress } from '../../src/shared/types';

const progress: QuestionProgress = {
  source: 'college-board-question-bank', questionKey: 'sha256_abc', questionKeyMethod: 'fingerprint',
  section: 'Math', domain: 'Algebra', skill: 'Linear equations', difficulty: 'Hard',
  status: 'review', lastResult: null, attemptCount: 1,
  firstSeenAt: '2026-07-01T10:00:00.000Z', lastSeenAt: '2026-07-01T10:01:00.000Z', updatedAt: '2026-07-01T10:01:00.000Z'
};

describe('extension manifest', () => {
  it('uses narrow College Board host permissions', () => {
    expect(manifest.host_permissions).toContain('https://satsuitequestionbank.collegeboard.org/*');
    expect(manifest.host_permissions).not.toContain('*://*.collegeboard.org/*');
  });
});

describe('handleMessage', () => {
  it('saves and reads progress through the local database', async () => {
    await handleMessage({ type: 'progress:save', progress }, vi.fn());
    const response = await handleMessage({ type: 'progress:get', source: 'college-board-question-bank', questionKey: 'sha256_abc' }, vi.fn());
    expect(response).toMatchObject({ ok: true, progress: { status: 'review' } });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/background/messageRouter.test.ts`

Expected: FAIL because `messageRouter.ts` does not exist.

- [ ] **Step 3: Implement the router and service worker wiring**

Create `src/background/messageRouter.ts`:

```ts
import { getLocalProgress, upsertLocalProgress } from '../storage/localDb';
import type { QuestionProgress, QuestionSource } from '../shared/types';

type RuntimeMessage =
  | { type: 'progress:get'; source: QuestionSource; questionKey: string }
  | { type: 'progress:save'; progress: QuestionProgress };

type Sender = chrome.runtime.MessageSender | ((...args: unknown[]) => unknown);

export async function handleMessage(message: RuntimeMessage, _sender: Sender) {
  if (message.type === 'progress:get') {
    const progress = await getLocalProgress(message.source, message.questionKey);
    return { ok: true, progress };
  }

  if (message.type === 'progress:save') {
    await upsertLocalProgress(message.progress);
    return { ok: true };
  }

  return { ok: false, error: 'UNKNOWN_MESSAGE' };
}
```

Modify `src/background/serviceWorker.ts`:

```ts
import { handleMessage } from './messageRouter';

chrome.runtime.onInstalled.addListener(() => console.info('Question Bank Overlay installed'));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }));
  return true;
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/background/messageRouter.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/background/messageRouter.ts src/background/serviceWorker.ts tests/background/messageRouter.test.ts
git commit -m "feat: route overlay progress messages"
```

---

### Task 6: Add The Overlay UI In Local Mode

**Files:**
- Create: `src/content/main.tsx`
- Create: `src/content/OverlayRoot.tsx`
- Create: `src/content/overlay.css`

- [ ] **Step 1: Add the overlay root component**

Create `src/content/OverlayRoot.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { detectQuestion } from './questionDetector';
import type { QuestionMetadata, QuestionProgress, StudyStatus, SyncState } from '../shared/types';

const statuses: StudyStatus[] = ['correct', 'missed', 'unsure', 'review', 'done'];

export function OverlayRoot() {
  const [metadata, setMetadata] = useState<QuestionMetadata | null>(null);
  const [progress, setProgress] = useState<QuestionProgress | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('saved');

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentQuestion() {
      const detected = await detectQuestion(document);
      if (cancelled) return;
      setMetadata(detected);
      if (!detected) return;

      const response = await chrome.runtime.sendMessage({
        type: 'progress:get',
        source: detected.source,
        questionKey: detected.questionKey
      });

      if (response?.ok && response.progress) setProgress(response.progress);
    }

    loadCurrentQuestion();
    return () => { cancelled = true; };
  }, []);

  async function mark(status: StudyStatus) {
    if (!metadata) return;
    const now = new Date().toISOString();
    const nextProgress: QuestionProgress = {
      ...metadata,
      status,
      lastResult: status === 'correct' || status === 'missed' || status === 'unsure' ? status : progress?.lastResult ?? null,
      attemptCount: (progress?.attemptCount ?? 0) + 1,
      firstSeenAt: progress?.firstSeenAt ?? now,
      lastSeenAt: now,
      updatedAt: now
    };

    setProgress(nextProgress);
    setSyncState('saving');
    await chrome.runtime.sendMessage({ type: 'progress:save', progress: nextProgress });
    setSyncState('saved');
  }

  return (
    <aside className="qbo-panel" aria-label="Question Bank Overlay">
      <header className="qbo-header"><strong>Study Overlay</strong><span className="qbo-sync">{syncState}</span></header>
      {!metadata ? <p className="qbo-muted">Question not recognized on this page.</p> : (
        <>
          <div className="qbo-meta"><span>{metadata.section ?? 'Section unknown'}</span><span>{metadata.domain ?? 'Domain unknown'}</span><span>{metadata.difficulty ?? 'Difficulty unknown'}</span></div>
          <div className="qbo-status">Current: {progress?.status ?? 'unseen'}</div>
          <div className="qbo-actions">{statuses.map((status) => <button key={status} type="button" onClick={() => mark(status)}>{status}</button>)}</div>
          <label className="qbo-note-label" htmlFor="qbo-note">Private note</label>
          <textarea id="qbo-note" placeholder="Write a private note. Do not paste full question text." rows={5} />
          <p className="qbo-muted">Attempts: {progress?.attemptCount ?? 0}</p>
        </>
      )}
    </aside>
  );
}
```

Create `src/content/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayRoot } from './OverlayRoot';
import './overlay.css';

const containerId = 'question-bank-overlay-root';

if (!document.getElementById(containerId)) {
  const container = document.createElement('div');
  container.id = containerId;
  document.documentElement.appendChild(container);
  createRoot(container).render(<OverlayRoot />);
}
```

Create `src/content/overlay.css`:

```css
#question-bank-overlay-root { position: fixed; top: 96px; right: 16px; z-index: 2147483647; font-family: Arial, sans-serif; }
.qbo-panel { width: 300px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; color: #1f2328; box-shadow: 0 12px 32px rgba(31,35,40,.18); padding: 12px; }
.qbo-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.qbo-sync { font-size: 12px; color: #57606a; }
.qbo-meta, .qbo-actions { display: grid; gap: 6px; margin: 10px 0; }
.qbo-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.qbo-actions button { min-height: 32px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer; }
.qbo-note-label { display: block; margin: 10px 0 4px; font-size: 12px; font-weight: 700; }
#qbo-note { width: 100%; box-sizing: border-box; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px; resize: vertical; }
.qbo-muted { color: #57606a; font-size: 12px; }
.qbo-status { font-size: 13px; font-weight: 700; }
```

- [ ] **Step 2: Build and typecheck**

Run: `npm run build`

Expected: `dist/assets/content.js`, `dist/assets/background.js`, and `dist/manifest.json` exist.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/content
git commit -m "feat: add local overlay UI"
```

---

### Task 7: Add Supabase Schema With Row-Level Security

**Files:**
- Create: `supabase/migrations/202607010001_initial_schema.sql`

- [ ] **Step 1: Add the migration**

Create `supabase/migrations/202607010001_initial_schema.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.question_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  question_key text not null,
  question_key_method text not null check (question_key_method in ('visible-id', 'fingerprint')),
  section text,
  domain text,
  skill text,
  difficulty text,
  status text not null check (status in ('unseen', 'done', 'correct', 'missed', 'unsure', 'review')),
  last_result text check (last_result in ('correct', 'missed', 'unsure')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, source, question_key)
);

create table public.question_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  question_key text not null,
  note text not null check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  unique (user_id, source, question_key)
);

create table public.filter_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  source text not null check (source = 'college-board-question-bank'),
  filters_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  started_at timestamptz not null,
  ended_at timestamptz,
  seen_count integer not null default 0 check (seen_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  missed_count integer not null default 0 check (missed_count >= 0),
  unsure_count integer not null default 0 check (unsure_count >= 0),
  review_count integer not null default 0 check (review_count >= 0)
);

alter table public.profiles enable row level security;
alter table public.question_progress enable row level security;
alter table public.question_notes enable row level security;
alter table public.filter_presets enable row level security;
alter table public.study_sessions enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "progress own rows" on public.question_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes own rows" on public.question_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "filter presets own rows" on public.filter_presets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study sessions own rows" on public.study_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index question_progress_user_updated_idx on public.question_progress (user_id, updated_at desc);
create index question_notes_user_updated_idx on public.question_notes (user_id, updated_at desc);
```

- [ ] **Step 2: Validate the migration locally**

Run: `npx supabase db lint`

Expected: PASS, or a message that the Supabase CLI package is missing.

If the package is missing, run: `npm install --save-dev supabase`

Then run: `npx supabase db lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202607010001_initial_schema.sql package.json package-lock.json
git commit -m "feat: add supabase schema"
```

---

### Task 8: Add Supabase Client, Auth Storage, And Progress Repository

**Files:**
- Create: `src/config/env.ts`
- Create: `src/sync/supabaseClient.ts`
- Create: `src/sync/progressRepository.ts`
- Test: `tests/sync/progressRepository.test.ts`

- [ ] **Step 1: Write repository tests**

Create `tests/sync/progressRepository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { saveProgressRemote } from '../../src/sync/progressRepository';
import type { QuestionProgress } from '../../src/shared/types';

const progress: QuestionProgress = {
  source: 'college-board-question-bank', questionKey: 'sha256_abc', questionKeyMethod: 'fingerprint',
  section: 'Math', domain: 'Algebra', skill: 'Linear equations', difficulty: 'Hard',
  status: 'correct', lastResult: 'correct', attemptCount: 1,
  firstSeenAt: '2026-07-01T10:00:00.000Z', lastSeenAt: '2026-07-01T10:01:00.000Z', updatedAt: '2026-07-01T10:01:00.000Z'
};

describe('saveProgressRemote', () => {
  it('upserts progress without raw question content', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from };

    await saveProgressRemote(client, 'user_1', progress);

    expect(from).toHaveBeenCalledWith('question_progress');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user_1', question_key: 'sha256_abc' }), { onConflict: 'user_id,source,question_key' });
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toContain('prompt');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/sync/progressRepository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Add Supabase modules**

Create `src/config/env.ts`:

```ts
export function getRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
```

Create `src/sync/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../config/env';

const chromeStorageAdapter = {
  async getItem(key: string) { const result = await chrome.storage.local.get(key); return result[key] ?? null; },
  async setItem(key: string, value: string) { await chrome.storage.local.set({ [key]: value }); },
  async removeItem(key: string) { await chrome.storage.local.remove(key); }
};

export function createSupabaseClient() {
  return createClient(getRequiredEnv('VITE_SUPABASE_URL'), getRequiredEnv('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: chromeStorageAdapter }
  });
}
```

Create `src/sync/progressRepository.ts`:

```ts
import { toProgressPayload } from '../shared/syncPayload';
import type { QuestionProgress } from '../shared/types';

type SupabaseLike = {
  from(table: string): {
    upsert(payload: unknown, options: { onConflict: string }): Promise<{ error: Error | null }>;
  };
};

export async function saveProgressRemote(client: SupabaseLike, userId: string, progress: QuestionProgress): Promise<void> {
  const { error } = await client
    .from('question_progress')
    .upsert(toProgressPayload(userId, progress), { onConflict: 'user_id,source,question_key' });
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/sync/progressRepository.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/sync tests/sync
git commit -m "feat: add supabase progress repository"
```

---

### Task 9: Add Sync Queue And Auth-Aware Background Handling

**Files:**
- Create: `src/sync/syncQueue.ts`
- Modify: `src/background/messageRouter.ts`
- Modify: `src/background/serviceWorker.ts`

- [ ] **Step 1: Add sync queue implementation**

Create `src/sync/syncQueue.ts`:

```ts
import { listDirtyProgress, markProgressSynced } from '../storage/localDb';
import { createSupabaseClient } from './supabaseClient';
import { saveProgressRemote } from './progressRepository';

export async function syncDirtyProgress(): Promise<{ synced: number; skipped: boolean }> {
  const client = createSupabaseClient();
  const { data } = await client.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { synced: 0, skipped: true };

  const dirtyProgress = await listDirtyProgress();
  for (const progress of dirtyProgress) {
    await saveProgressRemote(client, userId, progress);
    await markProgressSynced(progress.source, progress.questionKey);
  }

  return { synced: dirtyProgress.length, skipped: false };
}
```

Replace `src/background/messageRouter.ts` with:

```ts
import { getLocalProgress, upsertLocalProgress } from '../storage/localDb';
import { syncDirtyProgress } from '../sync/syncQueue';
import type { QuestionProgress, QuestionSource } from '../shared/types';

type RuntimeMessage =
  | { type: 'progress:get'; source: QuestionSource; questionKey: string }
  | { type: 'progress:save'; progress: QuestionProgress }
  | { type: 'sync:flush' };

type Sender = chrome.runtime.MessageSender | ((...args: unknown[]) => unknown);

export async function handleMessage(message: RuntimeMessage, _sender: Sender) {
  if (message.type === 'progress:get') {
    const progress = await getLocalProgress(message.source, message.questionKey);
    return { ok: true, progress };
  }

  if (message.type === 'progress:save') {
    await upsertLocalProgress(message.progress);
    syncDirtyProgress().catch((error: unknown) => console.warn('Sync delayed', error));
    return { ok: true };
  }

  if (message.type === 'sync:flush') {
    const result = await syncDirtyProgress();
    return { ok: true, result };
  }

  return { ok: false, error: 'UNKNOWN_MESSAGE' };
}
```

Replace `src/background/serviceWorker.ts` with:

```ts
import { handleMessage } from './messageRouter';
import { syncDirtyProgress } from '../sync/syncQueue';

chrome.runtime.onInstalled.addListener(() => console.info('Question Bank Overlay installed'));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }));
  return true;
});

chrome.runtime.onStartup.addListener(() => {
  syncDirtyProgress().catch((error: unknown) => console.warn('Startup sync delayed', error));
});
```

- [ ] **Step 2: Run tests and typecheck**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/background src/sync/syncQueue.ts
git commit -m "feat: sync dirty progress records"
```

---

### Task 10: Add Popup Auth UI For Email And Google Sign-In

**Files:**
- Create: `src/popup/main.tsx`
- Create: `src/popup/Popup.tsx`
- Modify: `src/background/messageRouter.ts`

- [ ] **Step 1: Add auth messages in the background router**

Replace `src/background/messageRouter.ts` with:

```ts
import { getLocalProgress, upsertLocalProgress } from '../storage/localDb';
import { createSupabaseClient } from '../sync/supabaseClient';
import { syncDirtyProgress } from '../sync/syncQueue';
import type { QuestionProgress, QuestionSource } from '../shared/types';

type RuntimeMessage =
  | { type: 'progress:get'; source: QuestionSource; questionKey: string }
  | { type: 'progress:save'; progress: QuestionProgress }
  | { type: 'sync:flush' }
  | { type: 'auth:getUser' }
  | { type: 'auth:signInWithPassword'; email: string; password: string }
  | { type: 'auth:signInWithGoogle' }
  | { type: 'auth:signOut' };

type Sender = chrome.runtime.MessageSender | ((...args: unknown[]) => unknown);

export async function handleMessage(message: RuntimeMessage, _sender: Sender) {
  if (message.type === 'progress:get') {
    const progress = await getLocalProgress(message.source, message.questionKey);
    return { ok: true, progress };
  }

  if (message.type === 'progress:save') {
    await upsertLocalProgress(message.progress);
    syncDirtyProgress().catch((error: unknown) => console.warn('Sync delayed', error));
    return { ok: true };
  }

  if (message.type === 'sync:flush') {
    const result = await syncDirtyProgress();
    return { ok: true, result };
  }

  if (message.type === 'auth:getUser') {
    const client = createSupabaseClient();
    const { data, error } = await client.auth.getUser();
    return error ? { ok: false, error: error.message } : { ok: true, user: data.user };
  }

  if (message.type === 'auth:signInWithPassword') {
    const client = createSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email: message.email, password: message.password });
    return error ? { ok: false, error: error.message } : { ok: true, user: data.user };
  }

  if (message.type === 'auth:signInWithGoogle') {
    const client = createSupabaseClient();
    const redirectTo = chrome.identity.getRedirectURL('supabase');
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error || !data.url) return { ok: false, error: error?.message ?? 'GOOGLE_AUTH_URL_MISSING' };

    const callbackUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    const code = new URL(callbackUrl).searchParams.get('code');
    if (!code) return { ok: false, error: 'GOOGLE_AUTH_CODE_MISSING' };

    const sessionResult = await client.auth.exchangeCodeForSession(code);
    return sessionResult.error ? { ok: false, error: sessionResult.error.message } : { ok: true, user: sessionResult.data.user };
  }

  if (message.type === 'auth:signOut') {
    const client = createSupabaseClient();
    const { error } = await client.auth.signOut();
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  return { ok: false, error: 'UNKNOWN_MESSAGE' };
}
```

- [ ] **Step 2: Add popup UI**

Create `src/popup/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';

createRoot(document.getElementById('root') as HTMLElement).render(<Popup />);
```

Create `src/popup/Popup.tsx`:

```tsx
import { FormEvent, useEffect, useState } from 'react';

type AuthUser = { email?: string | null } | null;

export function Popup() {
  const [user, setUser] = useState<AuthUser>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'auth:getUser' }).then((response) => {
      if (response?.ok) setUser(response.user);
    });
  }, []);

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    setMessage('Signing in');
    const response = await chrome.runtime.sendMessage({ type: 'auth:signInWithPassword', email, password });
    if (response?.ok) { setUser(response.user); setMessage('Signed in'); }
    else setMessage(response?.error ?? 'Sign-in failed');
  }

  async function signInWithGoogle() {
    setMessage('Opening Google sign-in');
    const response = await chrome.runtime.sendMessage({ type: 'auth:signInWithGoogle' });
    if (response?.ok) { setUser(response.user); setMessage('Signed in'); }
    else setMessage(response?.error ?? 'Google sign-in failed');
  }

  async function signOut() {
    await chrome.runtime.sendMessage({ type: 'auth:signOut' });
    setUser(null);
    setMessage('Signed out');
  }

  return (
    <main style={{ width: 320, padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>Question Bank Overlay</h1>
      {user ? (
        <section><p>Signed in as {user.email}</p><button type="button" onClick={signOut}>Sign out</button></section>
      ) : (
        <section>
          <form onSubmit={signInWithPassword}>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
            <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label>
            <button type="submit">Sign in</button>
          </form>
          <button type="button" onClick={signInWithGoogle}>Continue with Google</button>
        </section>
      )}
      <p aria-live="polite">{message}</p>
    </main>
  );
}
```

- [ ] **Step 3: Configure Supabase redirect URLs**

In the Supabase dashboard, add this redirect URL for the unpacked extension during development:

```txt
https://<chrome-extension-id>.chromiumapp.org/supabase
```

After packaging the extension, add the production extension ID redirect URL in the same format.

- [ ] **Step 4: Build and typecheck**

Run: `npm run build`

Expected: PASS and `dist/popup.html` exists.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/background/messageRouter.ts src/popup popup.html
git commit -m "feat: add extension auth popup"
```

---

### Task 11: Save Private Notes Locally And Remotely

**Files:**
- Modify: `src/storage/localDb.ts`
- Modify: `src/sync/progressRepository.ts`
- Modify: `src/content/OverlayRoot.tsx`
- Modify: `src/background/messageRouter.ts`
- Test: `tests/storage/localDb.test.ts`

- [ ] **Step 1: Extend note storage tests**

Add this test to `tests/storage/localDb.test.ts`:

```ts
import { getLocalNote, upsertLocalNote } from '../../src/storage/localDb';

it('stores private notes by source and question key', async () => {
  await upsertLocalNote({
    source: 'college-board-question-bank',
    questionKey: 'sha256_abc',
    note: 'Review why I picked B.',
    updatedAt: '2026-07-01T10:02:00.000Z'
  });

  await expect(getLocalNote('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({ note: 'Review why I picked B.' });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/storage/localDb.test.ts`

Expected: FAIL because note storage functions do not exist.

- [ ] **Step 3: Extend local storage**

Add `StoredNote`, a `notes` object store, and these functions to `src/storage/localDb.ts`:

```ts
import type { QuestionNote } from '../shared/types';

interface StoredNote extends QuestionNote { localKey: string; dirty: boolean }

export async function upsertLocalNote(note: QuestionNote): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(note.source, note.questionKey);
  await db.put('notes', { ...note, localKey, dirty: true });
}

export async function getLocalNote(source: QuestionSource, questionKey: string): Promise<QuestionNote | null> {
  const db = await getDb();
  const record = await db.get('notes', makeLocalKey(source, questionKey));
  if (!record) return null;
  const { localKey: _localKey, dirty: _dirty, ...note } = record;
  return note;
}
```

Update `OverlayDb`:

```ts
interface OverlayDb extends DBSchema {
  progress: { key: string; value: StoredProgress };
  notes: { key: string; value: StoredNote };
}
```

Update `getDb()`:

```ts
if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'localKey' });
```

- [ ] **Step 4: Add note messages and overlay save**

Set the `src/background/messageRouter.ts` storage import to:

```ts
import { getLocalNote, getLocalProgress, upsertLocalNote, upsertLocalProgress } from '../storage/localDb';
```

Extend `RuntimeMessage` with:

```ts
| { type: 'note:get'; source: QuestionSource; questionKey: string }
| { type: 'note:save'; note: QuestionNote }
```

Add `QuestionNote` to the shared type import:

```ts
import type { QuestionNote, QuestionProgress, QuestionSource } from '../shared/types';
```

Add these branches before the `UNKNOWN_MESSAGE` return:

```ts
if (message.type === 'note:get') {
  const note = await getLocalNote(message.source, message.questionKey);
  return { ok: true, note };
}

if (message.type === 'note:save') {
  await upsertLocalNote(message.note);
  return { ok: true };
}
```

Add this save function in `OverlayRoot.tsx`:

```tsx
async function saveNote(value: string) {
  if (!metadata) return;
  const validation = validateNote(value);
  if (!validation.ok) return;
  const now = new Date().toISOString();
  setNote(validation.value);
  await chrome.runtime.sendMessage({
    type: 'note:save',
    note: { source: metadata.source, questionKey: metadata.questionKey, note: validation.value, updatedAt: now }
  });
}
```

Set textarea handlers to:

```tsx
onBlur={(event) => saveNote(event.target.value)}
onChange={(event) => setNote(event.target.value)}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/storage/localDb.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/localDb.ts src/background/messageRouter.ts src/content/OverlayRoot.tsx tests/storage/localDb.test.ts
git commit -m "feat: save private notes"
```

---

### Task 12: Add Manual QA Checklist And Release Build Verification

**Files:**
- Create: `docs/qa/manual-mvp-checklist.md`

- [ ] **Step 1: Add manual QA checklist**

Create `docs/qa/manual-mvp-checklist.md`:

```md
# Manual MVP QA Checklist

## Build

- Run `npm install`.
- Run `npm test` and confirm all tests pass.
- Run `npm run typecheck` and confirm there are no TypeScript errors.
- Run `npm run build` and confirm `dist/manifest.json` exists.

## Chrome Extension Load

- Open Chrome Extensions.
- Enable Developer Mode.
- Load unpacked extension from `dist`.
- Confirm the extension appears as `Question Bank Overlay`.

## College Board Overlay

- Open `https://satsuitequestionbank.collegeboard.org/`.
- Confirm the overlay appears only on the supported host.
- Confirm the overlay shows `Question not recognized on this page` on non-question pages.
- Open a visible question page.
- Mark the question `correct`.
- Refresh the page.
- Confirm the status remains `correct`.

## Notes

- Add a note shorter than 2,000 characters.
- Blur the note field.
- Refresh the page.
- Confirm the note reloads.
- Try a note over 2,000 characters.
- Confirm it is not saved.

## Auth And Sync

- Sign in with email/password from the popup.
- Mark a question and force sync with the `sync:flush` background message during development.
- Confirm the row appears in Supabase `question_progress` for only that user.
- Sign out.
- Confirm local mode still lets the overlay save progress locally.
- Sign in with Google after the Supabase redirect URL is configured.

## Privacy Boundary

- Inspect Supabase `question_progress` rows.
- Confirm there is no raw prompt text, answer choice text, explanation text, image URL, or PDF content.
- Inspect `question_notes` rows.
- Confirm notes are private and scoped to the signed-in user.
```

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS and Chrome can load `dist` as an unpacked extension.

- [ ] **Step 3: Commit**

```bash
git add docs/qa/manual-mvp-checklist.md
git commit -m "docs: add manual mvp qa checklist"
```

---

## Self-Review Notes

Spec coverage:

- Overlay UI: Tasks 6 and 11.
- Per-question progress: Tasks 2, 4, 5, and 6.
- Private synced notes: Tasks 7, 8, 9, 10, and 11.
- Cross-device account sync: Tasks 7, 8, 9, and 10.
- Local cache and offline fallback: Tasks 4, 5, and 9.
- Narrow permissions and no hidden API calls: Tasks 1, 3, and 12.
- Testing: Tasks 1 through 5, 8, and 12.

Execution guidance:

- Implement tasks in order.
- Commit after each task.
- Keep live College Board testing manual and minimal.
- Use saved/mock DOM fixtures for detector tests.