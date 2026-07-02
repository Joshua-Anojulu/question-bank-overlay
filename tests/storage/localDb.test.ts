import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalDb,
  getLocalNote,
  getLocalProgress,
  listDirtyNotes,
  listDirtyProgress,
  markNoteSynced,
  markProgressSynced,
  upsertLocalNote,
  upsertLocalProgress
} from '../../src/storage/localDb';
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
  beforeEach(async () => {
    await clearLocalDb();
  });

  it('stores and reads progress by source and question key', async () => {
    await upsertLocalProgress(baseProgress);
    await expect(getLocalProgress('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({
      status: 'correct'
    });
  });

  it('keeps the newest progress record by updatedAt', async () => {
    await upsertLocalProgress({ ...baseProgress, status: 'missed', updatedAt: '2026-07-01T10:02:00.000Z' });
    await upsertLocalProgress({ ...baseProgress, status: 'correct', updatedAt: '2026-07-01T10:01:00.000Z' });

    await expect(getLocalProgress('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({
      status: 'missed'
    });
  });

  it('tracks dirty progress until it is marked synced', async () => {
    await upsertLocalProgress(baseProgress);
    expect(await listDirtyProgress()).toHaveLength(1);

    await markProgressSynced('college-board-question-bank', 'sha256_abc');
    expect(await listDirtyProgress()).toHaveLength(0);
  });

  it('stores private notes by source and question key', async () => {
    await upsertLocalNote({
      source: 'college-board-question-bank',
      questionKey: 'sha256_abc',
      note: 'Review why I picked B.',
      updatedAt: '2026-07-01T10:02:00.000Z'
    });

    await expect(getLocalNote('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({
      note: 'Review why I picked B.'
    });
  });

  it('tracks dirty notes until they are marked synced', async () => {
    await upsertLocalNote({
      source: 'college-board-question-bank',
      questionKey: 'sha256_abc',
      note: 'Review why I picked B.',
      updatedAt: '2026-07-01T10:02:00.000Z'
    });
    expect(await listDirtyNotes()).toHaveLength(1);

    await markNoteSynced('college-board-question-bank', 'sha256_abc');
    expect(await listDirtyNotes()).toHaveLength(0);
  });
});
