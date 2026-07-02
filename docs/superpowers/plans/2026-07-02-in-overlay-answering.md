# In-Overlay Answering And Result Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user answer a SAT question in the overlay, grade it against the revealed `Correct Answer:` text, and save only their answer + result to their private database.

**Architecture:** Add a pure answer detector/grader, extend the progress model and shared types with `selectedAnswer`/`answeredAt`, render an Answer section in the vanilla-DOM overlay, and hook grading into the existing `MutationObserver` re-detection. Persistence reuses the existing `progress:save` message and Supabase sync; a migration adds two nullable columns.

**Tech Stack:** TypeScript, Vite, Vitest, Chrome MV3 content script (vanilla DOM), IndexedDB via `idb`, Supabase Postgres.

## Global Constraints

- Windows PowerShell: use `npm.cmd`, not `npm`.
- Privacy boundary: never store question text, answer choices, explanations, images, or the correct answer. Store only the user's own answer, a boolean result, timestamps, keys, and existing metadata.
- Host is `satsuiteeducatorquestionbank.collegeboard.org`; do not widen permissions.
- `selectedAnswer` and `answeredAt` are optional (`?: string | null`) on `QuestionProgress` and `ProgressPayload` to avoid breaking existing fixtures.
- Full verification after each task: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`.

---

## File Structure

- `src/shared/types.ts` (modify) — add optional `selectedAnswer` / `answeredAt` to `QuestionProgress` and `ProgressPayload`.
- `src/shared/syncPayload.ts` (modify) — map the two new fields to snake_case.
- `src/content/answerDetector.ts` (create) — read revealed answer, grade MC/grid-in.
- `src/content/progressModel.ts` (modify) — `recordAnswer`.
- `src/content/overlayDom.ts` (modify) — Answer section, reveal grading, collapse toggle.
- `src/content/overlay.css` (modify) — Answer/collapse styles, spacing fix.
- `supabase/migrations/202607020001_add_answer_columns.sql` (create) — new columns.
- Tests alongside each under `tests/`.

---

### Task 1: Add Answer Fields To Shared Types And Payload

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/syncPayload.ts`
- Test: `tests/shared/syncPayload.test.ts`

**Interfaces:**
- Produces: `QuestionProgress.selectedAnswer?: string | null`, `QuestionProgress.answeredAt?: string | null`; `ProgressPayload.selected_answer?: string | null`, `ProgressPayload.answered_at?: string | null`.

- [ ] **Step 1: Add a failing payload test**

Append to `tests/shared/syncPayload.test.ts`:

```ts
it('maps the user answer and answered timestamp, and never a correct answer key', () => {
  const progress: QuestionProgress = {
    source: 'college-board-question-bank',
    questionKey: 'ac472881',
    questionKeyMethod: 'visible-id',
    section: 'Math',
    domain: 'Algebra',
    skill: null,
    difficulty: 'Hard',
    status: 'missed',
    lastResult: 'missed',
    attemptCount: 1,
    firstSeenAt: '2026-07-02T10:00:00.000Z',
    lastSeenAt: '2026-07-02T10:05:00.000Z',
    updatedAt: '2026-07-02T10:05:00.000Z',
    selectedAnswer: 'C',
    answeredAt: '2026-07-02T10:05:00.000Z'
  };

  const payload = toProgressPayload('user_1', progress);

  expect(payload).toMatchObject({ selected_answer: 'C', answered_at: '2026-07-02T10:05:00.000Z' });
  expect(JSON.stringify(payload)).not.toContain('correct_answer');
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npm.cmd test -- tests/shared/syncPayload.test.ts`
Expected: FAIL (`selected_answer` undefined / type error on `selectedAnswer`).

- [ ] **Step 3: Extend the types**

In `src/shared/types.ts`, add to the `QuestionProgress` interface (after `updatedAt`):

```ts
  selectedAnswer?: string | null;
  answeredAt?: string | null;
```

And to the `ProgressPayload` interface (after `updated_at`):

```ts
  selected_answer?: string | null;
  answered_at?: string | null;
```

- [ ] **Step 4: Map the fields in the payload**

In `src/shared/syncPayload.ts`, add to the object returned by `toProgressPayload` (after `updated_at`):

```ts
    selected_answer: progress.selectedAnswer ?? null,
    answered_at: progress.answeredAt ?? null
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm.cmd test -- tests/shared/syncPayload.test.ts`
Expected: PASS.
Run: `npm.cmd run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/syncPayload.ts tests/shared/syncPayload.test.ts
git commit -m "feat: add selected answer fields to progress payload"
```

---

### Task 2: Add The Answer Detector And Grader

**Files:**
- Create: `src/content/answerDetector.ts`
- Test: `tests/content/answerDetector.test.ts`

**Interfaces:**
- Produces:
  - `type AnswerType = 'mc' | 'grid'`
  - `detectRevealedAnswer(root: Document): { letter?: string; value?: string } | null`
  - `gradeAnswer(selected: string, revealed: { letter?: string; value?: string }, type: AnswerType): boolean`

- [ ] **Step 1: Write failing tests**

Create `tests/content/answerDetector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectRevealedAnswer, gradeAnswer } from '../../src/content/answerDetector';

describe('detectRevealedAnswer', () => {
  it('reads the multiple-choice correct answer letter from the rationale', () => {
    document.body.innerHTML = `<div>Rationale Correct Answer: B Choice B is correct.</div>`;
    expect(detectRevealedAnswer(document)).toEqual({ letter: 'B' });
  });

  it('reads a readable grid-in value', () => {
    document.body.innerHTML = `<div>Correct Answer: 0.5</div>`;
    expect(detectRevealedAnswer(document)).toEqual({ value: '0.5' });
  });

  it('returns null when no correct answer is revealed', () => {
    document.body.innerHTML = `<div>Question ID: ac472881</div>`;
    expect(detectRevealedAnswer(document)).toBeNull();
  });
});

describe('gradeAnswer', () => {
  it('grades multiple choice case-insensitively', () => {
    expect(gradeAnswer('b', { letter: 'B' }, 'mc')).toBe(true);
    expect(gradeAnswer('A', { letter: 'B' }, 'mc')).toBe(false);
  });

  it('treats equivalent grid-in numbers and fractions as correct', () => {
    expect(gradeAnswer('0.5', { value: '1/2' }, 'grid')).toBe(true);
    expect(gradeAnswer('.5', { value: '0.5' }, 'grid')).toBe(true);
    expect(gradeAnswer('3', { value: '4' }, 'grid')).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- tests/content/answerDetector.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the detector and grader**

Create `src/content/answerDetector.ts`:

```ts
export type AnswerType = 'mc' | 'grid';

export interface RevealedAnswer {
  letter?: string;
  value?: string;
}

export function detectRevealedAnswer(root: Document): RevealedAnswer | null {
  const text = normalize(root.body?.textContent ?? '');

  const letter = text.match(/Correct Answer:\s*([A-D])\b/i)?.[1]?.toUpperCase();
  if (letter) return { letter };

  // Grid-in: only accept a short, answer-shaped token (math images yield nothing).
  const value = text.match(/Correct Answer:\s*([0-9]+(?:\.[0-9]+)?(?:\/[0-9]+)?)/)?.[1];
  if (value) return { value };

  return null;
}

export function gradeAnswer(selected: string, revealed: RevealedAnswer, type: AnswerType): boolean {
  if (type === 'mc') {
    return Boolean(revealed.letter) && selected.trim().toUpperCase() === revealed.letter;
  }

  const selectedValue = toNumber(selected);
  const revealedValue = revealed.value ? toNumber(revealed.value) : null;
  if (selectedValue === null || revealedValue === null) return false;
  return Math.abs(selectedValue - revealedValue) < 1e-9;
}

function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  const fraction = trimmed.match(/^(-?[0-9]+)\/([0-9]+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const decimal = Number(trimmed);
  return Number.isFinite(decimal) ? decimal : null;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm.cmd test -- tests/content/answerDetector.test.ts`
Expected: PASS.
Run: `npm.cmd run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/answerDetector.ts tests/content/answerDetector.test.ts
git commit -m "feat: detect and grade revealed answers"
```

---

### Task 3: Record An Answer In The Progress Model

**Files:**
- Modify: `src/content/progressModel.ts`
- Test: `tests/content/progressModel.test.ts`

**Interfaces:**
- Consumes: `AnswerType` from `answerDetector`.
- Produces: `recordAnswer(progress: QuestionProgress, input: { selectedAnswer: string; type: AnswerType; isCorrect: boolean }, now: string): QuestionProgress`.

- [ ] **Step 1: Write failing tests**

Append to `tests/content/progressModel.test.ts`:

```ts
import { recordAnswer } from '../../src/content/progressModel';

it('records a correct answer as correct and increments attempts', () => {
  const base = createInitialProgress(
    { source: 'college-board-question-bank', questionKey: 'ac472881', questionKeyMethod: 'visible-id', section: 'Math', domain: 'Algebra', skill: null, difficulty: 'Hard' },
    '2026-07-02T10:00:00.000Z'
  );

  const result = recordAnswer(base, { selectedAnswer: 'B', type: 'mc', isCorrect: true }, '2026-07-02T10:05:00.000Z');

  expect(result).toMatchObject({
    status: 'correct',
    lastResult: 'correct',
    attemptCount: 1,
    selectedAnswer: 'B',
    answeredAt: '2026-07-02T10:05:00.000Z'
  });
});

it('records an incorrect answer as missed', () => {
  const base = createInitialProgress(
    { source: 'college-board-question-bank', questionKey: 'ac472881', questionKeyMethod: 'visible-id', section: 'Math', domain: 'Algebra', skill: null, difficulty: 'Hard' },
    '2026-07-02T10:00:00.000Z'
  );

  const result = recordAnswer(base, { selectedAnswer: 'A', type: 'mc', isCorrect: false }, '2026-07-02T10:05:00.000Z');

  expect(result).toMatchObject({ status: 'missed', lastResult: 'missed', selectedAnswer: 'A' });
});
```

Ensure the file's existing import line includes `createInitialProgress` (it already imports from `../../src/content/progressModel`).

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- tests/content/progressModel.test.ts`
Expected: FAIL (`recordAnswer` not exported).

- [ ] **Step 3: Implement `recordAnswer`**

Add to `src/content/progressModel.ts`:

```ts
import type { AnswerType } from './answerDetector';

export function recordAnswer(
  progress: QuestionProgress,
  input: { selectedAnswer: string; type: AnswerType; isCorrect: boolean },
  now: string
): QuestionProgress {
  return {
    ...progress,
    status: input.isCorrect ? 'correct' : 'missed',
    lastResult: input.isCorrect ? 'correct' : 'missed',
    attemptCount: progress.attemptCount + 1,
    selectedAnswer: input.selectedAnswer,
    answeredAt: now,
    lastSeenAt: now,
    updatedAt: now
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm.cmd test -- tests/content/progressModel.test.ts`
Expected: PASS.
Run: `npm.cmd run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/progressModel.ts tests/content/progressModel.test.ts
git commit -m "feat: record answers in the progress model"
```

---

### Task 4: Add The Answer Section And Reveal Grading To The Overlay

**Files:**
- Modify: `src/content/overlayDom.ts`
- Modify: `src/content/overlay.css`
- Test: `tests/content/overlayDom.test.ts`

**Interfaces:**
- Consumes: `detectRevealedAnswer`, `gradeAnswer`, `AnswerType` (answerDetector); `recordAnswer` (progressModel).
- Produces: overlay renders `button[data-answer="A".."D"]`, a `button[data-answer-mode]` toggle, a grid-in `input.qbo-grid-input` + `button[data-grid-submit]`, self-mark `button[data-selfmark="correct"|"incorrect"]`, and a `button[data-collapse]` header toggle.

- [ ] **Step 1: Write failing tests**

Append these tests inside the `describe('mountOverlay', ...)` block in `tests/content/overlayDom.test.ts`:

```ts
it('auto-grades a multiple-choice answer when the correct answer is revealed', async () => {
  const host = document.createElement('div');
  const sendMessage = vi.fn(async (msg: { type: string }) => {
    if (msg.type === 'progress:get') return { ok: true, progress: null };
    if (msg.type === 'note:get') return { ok: true, note: null };
    return { ok: true };
  });
  let revealed: { letter?: string; value?: string } | null = null;

  const controller = mountOverlay(host, {
    detect: vi.fn().mockResolvedValue(metadata),
    detectRevealed: () => revealed,
    sendMessage: sendMessage as never,
    now: () => '2026-07-02T10:05:00.000Z',
    redetectDelayMs: 0
  });
  await controller.ready;

  host.querySelector<HTMLButtonElement>('button[data-answer="C"]')?.click();
  await Promise.resolve();

  revealed = { letter: 'B' };
  document.body.appendChild(document.createElement('div'));
  await waitFor(() => sendMessage.mock.calls.some((c: any) => c[0]?.type === 'progress:save' && c[0]?.progress?.status === 'missed'));

  const lastSave = sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m.type === 'progress:save').at(-1);
  expect(lastSave).toMatchObject({ type: 'progress:save', progress: expect.objectContaining({ selectedAnswer: 'C', status: 'missed' }) });

  controller.destroy();
});

it('lets the user self-mark a grid-in answer', async () => {
  const host = document.createElement('div');
  const sendMessage = vi.fn(async (msg: { type: string }) => {
    if (msg.type === 'progress:get') return { ok: true, progress: null };
    if (msg.type === 'note:get') return { ok: true, note: null };
    return { ok: true };
  });

  const controller = mountOverlay(host, {
    detect: vi.fn().mockResolvedValue(metadata),
    detectRevealed: () => null,
    sendMessage: sendMessage as never,
    now: () => '2026-07-02T10:05:00.000Z',
    redetectDelayMs: 0
  });
  await controller.ready;

  host.querySelector<HTMLButtonElement>('button[data-answer-mode]')?.click();
  await Promise.resolve();
  const input = host.querySelector<HTMLInputElement>('input.qbo-grid-input');
  if (input) input.value = '0.5';
  host.querySelector<HTMLButtonElement>('button[data-grid-submit]')?.click();
  await Promise.resolve();

  host.querySelector<HTMLButtonElement>('button[data-selfmark="correct"]')?.click();
  await waitFor(() => sendMessage.mock.calls.some((c: any) => c[0]?.type === 'progress:save' && c[0]?.progress?.status === 'correct'));

  const lastSave = sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m.type === 'progress:save').at(-1);
  expect(lastSave).toMatchObject({ type: 'progress:save', progress: expect.objectContaining({ selectedAnswer: '0.5', status: 'correct' }) });

  controller.destroy();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- tests/content/overlayDom.test.ts`
Expected: FAIL (no answer buttons; `detectRevealed` service unknown).

- [ ] **Step 3: Extend the overlay services**

In `src/content/overlayDom.ts`, add imports at the top:

```ts
import { detectRevealedAnswer, gradeAnswer, type AnswerType, type RevealedAnswer } from './answerDetector';
import { createInitialProgress, recordAnswer, updateProgressStatus } from './progressModel';
```

(Replace the existing `progressModel` import line with the one above.)

Add to the `OverlayServices` type (after `redetectDelayMs`):

```ts
  detectRevealed: (root: Document) => RevealedAnswer | null;
```

Add to the `services` default object (after `redetectDelayMs: 500,`):

```ts
    detectRevealed: detectRevealedAnswer,
```

- [ ] **Step 4: Add answer state and grading logic**

In `mountOverlay`, add state variables next to the others (after `let redetectTimer...`):

```ts
  let answerMode: AnswerType = 'mc';
  let pendingAnswer: string | null = null;
  let graded = false;
```

In `loadQuestionState`, after `lastDetectedKey = metadata?.questionKey ?? null;`, reset per-question answer state:

```ts
    pendingAnswer = null;
    graded = false;
    answerMode = 'mc';
```

Replace the body of `redetect` with reveal-aware grading:

```ts
  async function redetect() {
    const detected = await services.detect(services.document);
    if ((detected?.questionKey ?? null) !== lastDetectedKey) {
      await loadQuestionState();
      return;
    }
    if (pendingAnswer !== null && !graded && answerMode === 'mc') {
      const revealed = services.detectRevealed(services.document);
      if (revealed) await applyGrade(gradeAnswer(pendingAnswer, revealed, 'mc'));
    }
  }
```

Add these functions inside `mountOverlay` (before `renderMessage`):

```ts
  async function selectAnswer(value: string) {
    if (!progress) return;
    pendingAnswer = value;
    graded = false;
    progress = { ...progress, selectedAnswer: value, answeredAt: services.now(), updatedAt: services.now() };
    syncState = 'saving';
    renderPanel();
    const response = await services.sendMessage<SaveResponse>({ type: 'progress:save', progress });
    syncState = response.ok ? 'saved' : 'sync-delayed';
    renderPanel();
  }

  async function applyGrade(isCorrect: boolean) {
    if (!progress || pendingAnswer === null) return;
    graded = true;
    progress = recordAnswer(progress, { selectedAnswer: pendingAnswer, type: answerMode, isCorrect }, services.now());
    syncState = 'saving';
    renderPanel();
    const response = await services.sendMessage<SaveResponse>({ type: 'progress:save', progress });
    syncState = response.ok ? 'saved' : 'sync-delayed';
    message = isCorrect ? 'Correct' : 'Incorrect';
    renderPanel();
  }
```

- [ ] **Step 5: Render the Answer section**

In `renderPanel`, immediately before the note `label` is created, insert the Answer section:

```ts
    const answer = createElement('div', 'qbo-answer');
    answer.setAttribute('aria-label', 'Answer');

    const modeToggle = appendTextElement(answer, 'button', answerMode === 'mc' ? 'Grid-in' : 'Multiple choice');
    modeToggle.type = 'button';
    modeToggle.dataset.answerMode = answerMode;
    modeToggle.addEventListener('click', () => {
      answerMode = answerMode === 'mc' ? 'grid' : 'mc';
      pendingAnswer = null;
      graded = false;
      renderPanel();
    });

    if (answerMode === 'mc') {
      const choices = createElement('div', 'qbo-choices');
      for (const letter of ['A', 'B', 'C', 'D']) {
        const button = appendTextElement(choices, 'button', letter);
        button.type = 'button';
        button.dataset.answer = letter;
        if (pendingAnswer === letter) button.classList.add('is-active');
        button.addEventListener('click', () => void selectAnswer(letter));
      }
      answer.append(choices);
    } else {
      const input = createElement('input', 'qbo-grid-input');
      input.type = 'text';
      input.value = pendingAnswer ?? '';
      const submit = appendTextElement(answer, 'button', 'Submit');
      submit.type = 'button';
      submit.dataset.gridSubmit = 'true';
      submit.addEventListener('click', () => void selectAnswer(input.value.trim()));
      answer.append(input);
      answer.append(submit);
    }

    if (pendingAnswer !== null && !graded) {
      const selfMark = createElement('div', 'qbo-selfmark');
      appendTextElement(selfMark, 'span', 'Reveal the answer, then confirm:');
      for (const mark of [['correct', 'Correct'], ['incorrect', 'Incorrect']] as const) {
        const button = appendTextElement(selfMark, 'button', mark[1]);
        button.type = 'button';
        button.dataset.selfmark = mark[0];
        button.addEventListener('click', () => void applyGrade(mark[0] === 'correct'));
      }
      answer.append(selfMark);
    }

    panel.append(answer);
```

- [ ] **Step 6: Add a collapse toggle and fix spacing**

In `renderPanel`, after `panel.setAttribute('aria-label', 'Question Bank Overlay');`, add a collapse control and short-circuit rendering when collapsed:

```ts
    const collapse = appendTextElement(panel, 'button', collapsed ? '+' : '–');
    collapse.type = 'button';
    collapse.dataset.collapse = 'true';
    collapse.className = 'qbo-collapse';
    collapse.addEventListener('click', () => {
      collapsed = !collapsed;
      renderPanel();
    });
    if (collapsed) {
      container.replaceChildren(panel);
      return;
    }
```

Add `let collapsed = false;` next to the other state variables in `mountOverlay`.

Append to `src/content/overlay.css`:

```css
.qbo-collapse { position: absolute; top: 8px; right: 8px; border: none; background: transparent; font-size: 16px; cursor: pointer; }
.qbo-panel { position: relative; }
.qbo-answer { display: grid; gap: 6px; margin: 10px 0; }
.qbo-choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.qbo-choices button, .qbo-answer button { min-height: 32px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer; }
.qbo-choices button.is-active { background: #0969da; color: #fff; }
.qbo-grid-input { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #d0d7de; border-radius: 6px; }
.qbo-selfmark { display: grid; gap: 6px; }
.qbo-metadata { margin: 8px 0; }
```

- [ ] **Step 7: Run tests, typecheck, build**

Run: `npm.cmd test -- tests/content/overlayDom.test.ts`
Expected: PASS (both new tests plus the existing three).
Run: `npm.cmd run typecheck`
Expected: PASS.
Run: `npm.cmd run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content/overlayDom.ts src/content/overlay.css tests/content/overlayDom.test.ts
git commit -m "feat: answer questions in the overlay and grade on reveal"
```

---

### Task 5: Add The Supabase Migration For Answer Columns

**Files:**
- Create: `supabase/migrations/202607020001_add_answer_columns.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/202607020001_add_answer_columns.sql`:

```sql
alter table public.question_progress
  add column if not exists selected_answer text,
  add column if not exists answered_at timestamptz;
```

- [ ] **Step 2: Verify build still passes**

Run: `npm.cmd run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202607020001_add_answer_columns.sql
git commit -m "feat: store selected answer and answered_at in supabase"
```

Note (manual, external): run this migration in the Supabase SQL editor against the project before relying on cross-device sync of answers.

---

### Task 6: Full Verification And QA Checklist Update

**Files:**
- Modify: `docs/qa/manual-mvp-checklist.md`

- [ ] **Step 1: Add answering QA steps**

Append to `docs/qa/manual-mvp-checklist.md`:

```md
## In-Overlay Answering

- Open a multiple-choice question; click A/B/C/D in the overlay.
- Reveal the answer on the page; confirm the panel shows Correct/Incorrect and the attempt count increments.
- Refresh; confirm the selected answer and status persist.
- Toggle Grid-in, enter a value, Submit, reveal the answer, and self-mark; confirm it saves.
- Collapse the panel with the header toggle; confirm it no longer overlaps the page difficulty indicator.
- In Supabase question_progress, confirm selected_answer + answered_at are present and there is no correct-answer/content column.
```

- [ ] **Step 2: Run full verification**

Run: `npm.cmd test`
Expected: PASS.
Run: `npm.cmd run typecheck`
Expected: PASS.
Run: `npm.cmd run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/qa/manual-mvp-checklist.md
git commit -m "docs: add answering QA steps"
```

---

## Self-Review Notes

Spec coverage:
- Answer detection/grading: Task 2. Progress recording: Task 3. Answer UI + reveal grading + self-mark + collapse/spacing fix: Task 4. Persistence fields: Task 1. Database: Task 5. QA/verification: Task 6.

Execution guidance:
- Implement tasks in order (Task 4 consumes Tasks 1–3).
- Commit after each task.
- Keep grid-in v1 as: auto-grade when the revealed value is text-readable, otherwise self-mark.
