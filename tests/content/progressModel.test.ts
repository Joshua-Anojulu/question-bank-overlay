import { describe, expect, it } from 'vitest';
import { createInitialProgress, recordAnswer, updateProgressStatus } from '../../src/content/progressModel';
import type { QuestionMetadata } from '../../src/shared/types';

const metadata: QuestionMetadata = {
  source: 'college-board-question-bank',
  questionKey: 'sha256_abc',
  questionKeyMethod: 'fingerprint',
  section: 'Math',
  domain: 'Algebra',
  skill: 'Linear equations',
  difficulty: 'Hard'
};

describe('progress model', () => {
  it('creates an unseen local record from detected metadata', () => {
    expect(createInitialProgress(metadata, '2026-07-01T10:00:00.000Z')).toMatchObject({
      ...metadata,
      status: 'unseen',
      lastResult: null,
      attemptCount: 0,
      firstSeenAt: '2026-07-01T10:00:00.000Z',
      lastSeenAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z'
    });
  });

  it('increments attempts for answer results', () => {
    const progress = createInitialProgress(metadata, '2026-07-01T10:00:00.000Z');
    const updated = updateProgressStatus(progress, 'correct', '2026-07-01T10:01:00.000Z');

    expect(updated).toMatchObject({
      status: 'correct',
      lastResult: 'correct',
      attemptCount: 1,
      lastSeenAt: '2026-07-01T10:01:00.000Z',
      updatedAt: '2026-07-01T10:01:00.000Z'
    });
  });

  it('clears status without counting another answer attempt', () => {
    const progress = updateProgressStatus(
      createInitialProgress(metadata, '2026-07-01T10:00:00.000Z'),
      'missed',
      '2026-07-01T10:01:00.000Z'
    );

    expect(updateProgressStatus(progress, 'unseen', '2026-07-01T10:02:00.000Z')).toMatchObject({
      status: 'unseen',
      lastResult: null,
      attemptCount: 1
    });
  });

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
});
