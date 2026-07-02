import { describe, expect, it } from 'vitest';
import { MAX_NOTE_LENGTH, validateNote } from '../../src/shared/noteValidation';

describe('validateNote', () => {
  it('accepts and normalizes short private notes', () => {
    expect(validateNote('  Review percent change trap.\r\n')).toEqual({
      ok: true,
      value: 'Review percent change trap.'
    });
  });

  it('rejects notes over the maximum length', () => {
    const longNote = 'x'.repeat(MAX_NOTE_LENGTH + 1);
    expect(validateNote(longNote)).toEqual({ ok: false, reason: 'NOTE_TOO_LONG' });
  });

  it('warns when a note appears to contain pasted question content', () => {
    const result = validateNote('Question: Which expression is equivalent to 2x + 4? Choice A Choice B');
    expect(result).toEqual({ ok: false, reason: 'QUESTION_CONTENT_NOT_ALLOWED' });
  });
});
