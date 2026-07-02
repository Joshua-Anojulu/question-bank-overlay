import { describe, expect, it } from 'vitest';
import { toNotePayload, toProgressPayload } from '../../src/shared/syncPayload';
import type { QuestionNote, QuestionProgress } from '../../src/shared/types';

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
});

describe('toNotePayload', () => {
  it('syncs only user-authored notes and stable keys', () => {
    const note: QuestionNote = {
      source: 'college-board-question-bank',
      questionKey: 'sha256_abc',
      note: 'Review why I picked B.',
      updatedAt: '2026-07-01T10:06:00.000Z'
    };

    expect(toNotePayload('user_1', note)).toEqual({
      user_id: 'user_1',
      source: 'college-board-question-bank',
      question_key: 'sha256_abc',
      note: 'Review why I picked B.',
      updated_at: '2026-07-01T10:06:00.000Z'
    });
  });
});
