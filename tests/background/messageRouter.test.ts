import { describe, expect, it, vi } from 'vitest';
import { handleMessage } from '../../src/background/messageRouter';
import { clearLocalDb, getLocalNote, getLocalProgress } from '../../src/storage/localDb';
import manifest from '../../public/manifest.json';
import type { QuestionProgress } from '../../src/shared/types';

vi.mock('../../src/sync/syncQueue', () => ({
  syncDirtyRecords: vi.fn().mockResolvedValue({ synced: 0, skipped: true })
}));

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

const progress: QuestionProgress = {
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

describe('handleMessage', () => {
  it('saves and reads local progress', async () => {
    await clearLocalDb();

    await expect(handleMessage({ type: 'progress:save', progress }, {})).resolves.toEqual({ ok: true });
    await expect(getLocalProgress('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({
      status: 'correct'
    });

    await expect(
      handleMessage({ type: 'progress:get', source: 'college-board-question-bank', questionKey: 'sha256_abc' }, {})
    ).resolves.toMatchObject({ ok: true, progress: { status: 'correct' } });
  });

  it('saves and reads local notes', async () => {
    await clearLocalDb();

    await expect(
      handleMessage({
        type: 'note:save',
        note: {
          source: 'college-board-question-bank',
          questionKey: 'sha256_abc',
          note: 'Review this one.',
          updatedAt: '2026-07-01T10:03:00.000Z'
        }
      }, {})
    ).resolves.toEqual({ ok: true });

    await expect(getLocalNote('college-board-question-bank', 'sha256_abc')).resolves.toMatchObject({
      note: 'Review this one.'
    });

    await expect(
      handleMessage({ type: 'note:get', source: 'college-board-question-bank', questionKey: 'sha256_abc' }, {})
    ).resolves.toMatchObject({ ok: true, note: { note: 'Review this one.' } });
  });
});
