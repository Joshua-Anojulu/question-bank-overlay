# In-Overlay Answering And Result Tracking — Design

> Extends the Question Bank Overlay MVP. Depends on the existing content overlay,
> question detector, background message router, IndexedDB cache, and Supabase sync.

## Goal

Let the user answer a SAT question directly in the overlay (multiple choice or
grid-in), have the extension grade it when the correct answer is revealed on the
page, and save the attempt to their private database — replacing the manual
export workflow. This keeps the existing privacy boundary: **no question content
or answer key is ever stored**; only the user's own answer and a boolean result.

## Context

- Host: `satsuiteeducatorquestionbank.collegeboard.org` (educator question bank; a
  single-page app rendered as a filter/table with a question preview panel).
- A question is identified by visible `Question ID: <id>` text (see the detector).
- When the user reveals the answer, the rationale contains plain text
  `Correct Answer: B` for multiple choice.
- Math expressions render as images, so grid-in correct values are frequently
  **not** readable as text. The design must degrade gracefully to self-report.

## Non-Goals

- Storing question prompts, answer choices, explanations, or the answer key.
- Full per-attempt history (only the latest attempt per question is kept).
- Advanced grid-in equivalence beyond simple numeric/fraction matching.
- Auto-revealing the answer (the user reveals it themselves).

## User Flow

1. Overlay detects the open question (existing behavior).
2. Overlay shows an **Answer** section:
   - Multiple choice: buttons **A B C D**.
   - Grid-in: a number/text input plus **Submit**.
3. The user selects/enters their answer. It is stored as the pending answer and
   persisted locally immediately (status shown as answered, awaiting grading).
4. The user reveals the answer on the page as they normally would.
5. The existing `MutationObserver` fires. `detectRevealedAnswer` reads
   `Correct Answer: X`:
   - Readable → grade the user's answer, set result (correct/missed), increment
     attempt count, save, and show a result line in the panel
     (e.g. `You answered C — Incorrect (correct: B)`).
   - Not readable (grid-in image) → show **[Correct] [Incorrect]** self-mark
     buttons; the chosen result is saved.
6. Saved data syncs to Supabase through the existing dirty-record queue.

Answering auto-sets `status` to `correct` or `missed`. The existing **Review**
and **Clear** actions remain for manual use when the user does not answer.

## Components

### `src/content/answerDetector.ts` (new)
- `detectRevealedAnswer(root: Document): { letter?: string; value?: string } | null`
  - Reads `Correct Answer:\s*([A-D])\b` for multiple choice (returns `letter`).
  - For grid-in, returns `value` only when the captured text is short, non-empty,
    and parseable as an answer; otherwise returns `null` (→ self-report).
- `gradeAnswer(selected, revealed, type): boolean`
  - MC: case-insensitive letter compare.
  - Grid-in: normalize whitespace; compare as numbers when both parse; treat a
    `a/b` fraction as its decimal value for equivalence (`0.5` == `1/2`).
- Question type / choice detection: MVP renders A–D for multiple choice and a
  grid-in input toggled by the user when detection is uncertain. Exact page
  selectors for auto-detecting type are finalized during implementation by
  inspecting the live DOM.

### `src/content/progressModel.ts` (extend)
- `recordAnswer(progress, { selectedAnswer, type, isCorrect }, now): QuestionProgress`
  - Sets `selectedAnswer`, `answeredAt = now`, `status`/`lastResult` from
    `isCorrect`, increments `attemptCount`, updates timestamps.

### `src/content/overlayDom.ts` (extend)
- Render the Answer section and result line; wire selection, submit, reveal-based
  grading (hooked into the existing re-detection observer), and self-mark buttons.
- Add a header **collapse/minimize** toggle and tighten metadata spacing so the
  panel no longer overlaps the page's own difficulty indicator.

### Shared types and payload
- `QuestionProgress` and `ProgressPayload` gain `selectedAnswer: string | null`
  and `answeredAt: string | null`.
- `toProgressPayload` maps them to `selected_answer` and `answered_at`.
- **Only** the user's `selectedAnswer` and boolean result are persisted; the
  revealed correct answer is used transiently for grading and shown in the UI,
  never written to storage or the payload.

### Storage and sync
- No message-router changes: answering reuses `progress:save` / `progress:get`.
- The IndexedDB record already spreads `QuestionProgress`, so the new fields carry
  through automatically.

### Database
- New migration adds nullable columns to `public.question_progress`:
  - `selected_answer text`
  - `answered_at timestamptz`
- Existing RLS policies already scope the row to the owning user; unchanged.

## Testing

- `answerDetector`: parse `Correct Answer: B`; grid-in numeric/fraction
  equivalence; image/unreadable value → `null`.
- `progressModel.recordAnswer`: correct and incorrect paths set fields as expected.
- `overlayDom`: pick → reveal → graded → `progress:save` called with the chosen
  answer and result; grid-in unreadable → self-mark path saves the chosen result.
- `syncPayload`: `selected_answer` / `answered_at` present; no answer-key field.

## Privacy Boundary (unchanged)

- Never store question text, answer choices, explanations, images, or the correct
  answer.
- Store only the user's own answer, a boolean result, timestamps, and existing
  metadata/keys. Grading reads the revealed answer transiently and discards it.
