export const MAX_NOTE_LENGTH = 2000;

export type NoteValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'NOTE_TOO_LONG' | 'QUESTION_CONTENT_NOT_ALLOWED' };

export function validateNote(note: string): NoteValidationResult {
  const normalized = note.replace(/\r\n/g, '\n').trim();

  if (normalized.length > MAX_NOTE_LENGTH) {
    return { ok: false, reason: 'NOTE_TOO_LONG' };
  }

  if (looksLikeCopiedQuestionContent(normalized)) {
    return { ok: false, reason: 'QUESTION_CONTENT_NOT_ALLOWED' };
  }

  return { ok: true, value: normalized };
}

function looksLikeCopiedQuestionContent(note: string): boolean {
  const lowered = note.toLowerCase();
  return lowered.includes('question:') && /choice\s+[a-d]/i.test(note);
}
