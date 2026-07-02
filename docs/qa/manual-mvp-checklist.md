# Manual MVP QA Checklist

## Build

- Run `npm.cmd install` if dependencies are missing.
- Run `npm.cmd test` and confirm all tests pass.
- Run `npm.cmd run typecheck` and confirm there are no TypeScript errors.
- Run `npm.cmd run build` and confirm `dist/manifest.json`, `dist/popup.html`, `dist/assets/background.js`, `dist/assets/content.js`, and `dist/assets/content.css` exist.

## Chrome Extension Load

- Open Chrome Extensions.
- Enable Developer Mode.
- Load the unpacked extension from `dist`.
- Confirm the extension appears as `Question Bank Overlay`.
- Confirm the extension requests only the College Board Question Bank host plus Supabase for sync.

## College Board Overlay

- Open `https://satsuitequestionbank.collegeboard.org/`.
- Confirm the overlay appears only on that supported host.
- Confirm the overlay shows `Question not recognized on this page.` on non-question pages.
- Open a visible question page.
- Mark the question `Correct`.
- Refresh the page.
- Confirm the status remains `correct`.
- Mark the same question `Missed`, then `Clear`, and confirm attempt count only increments for answer outcomes.

## Notes

- Add a note shorter than 2,000 characters.
- Blur the note field.
- Refresh the page.
- Confirm the note reloads.
- Try a note over 2,000 characters.
- Confirm it is not saved.
- Try a note that starts with copied prompt content and answer choices.
- Confirm the overlay refuses to save it.

## Auth And Sync

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the build.
- In the Supabase dashboard, add the unpacked extension redirect URL: `https://<chrome-extension-id>.chromiumapp.org/supabase`.
- After packaging the extension, add the production extension ID redirect URL in the same format.
- Sign in with email/password from the popup.
- Mark a question and force sync with a `sync:flush` background message during development.
- Confirm rows appear in Supabase `question_progress` and `question_notes` for only that signed-in user.
- Sign out.
- Confirm local mode still lets the overlay save progress and notes locally.
- Sign in with Google after the Supabase redirect URL is configured.

## Privacy Boundary

- Inspect Supabase `question_progress` rows.
- Confirm there is no raw prompt text, answer choice text, explanation text, image URL, or PDF content.
- Inspect Supabase `question_notes` rows.
- Confirm notes are private and scoped to the signed-in user.
- Confirm row-level security blocks another user from reading or writing those rows.
