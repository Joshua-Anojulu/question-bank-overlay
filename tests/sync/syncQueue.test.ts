import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncDirtyRecords } from '../../src/sync/syncQueue';
import { listDirtyNotes, listDirtyProgress, markNoteSynced, markProgressSynced } from '../../src/storage/localDb';
import { createSupabaseClient } from '../../src/sync/supabaseClient';
import { saveNoteRemote, saveProgressRemote } from '../../src/sync/progressRepository';
import type { QuestionNote, QuestionProgress } from '../../src/shared/types';

vi.mock('../../src/storage/localDb', () => ({
  listDirtyNotes: vi.fn(),
  listDirtyProgress: vi.fn(),
  markNoteSynced: vi.fn(),
  markProgressSynced: vi.fn()
}));

vi.mock('../../src/sync/supabaseClient', () => ({
  createSupabaseClient: vi.fn()
}));

vi.mock('../../src/sync/progressRepository', () => ({
  saveNoteRemote: vi.fn(),
  saveProgressRemote: vi.fn()
}));

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

const note: QuestionNote = {
  source: 'college-board-question-bank',
  questionKey: 'sha256_abc',
  note: 'Review why I picked B.',
  updatedAt: '2026-07-01T10:02:00.000Z'
};

describe('syncDirtyRecords', () => {
  beforeEach(() => {
    vi.mocked(listDirtyProgress).mockResolvedValue([progress]);
    vi.mocked(listDirtyNotes).mockResolvedValue([note]);
    vi.mocked(markProgressSynced).mockResolvedValue();
    vi.mocked(markNoteSynced).mockResolvedValue();
    vi.mocked(saveProgressRemote).mockResolvedValue();
    vi.mocked(saveNoteRemote).mockResolvedValue();
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_1' } }, error: null }) }
    } as never);
  });

  it('skips remote sync when no user is signed in', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }
    } as never);

    await expect(syncDirtyRecords()).resolves.toEqual({ synced: 0, skipped: true });
    expect(saveProgressRemote).not.toHaveBeenCalled();
    expect(saveNoteRemote).not.toHaveBeenCalled();
  });

  it('syncs dirty progress and notes, then marks them clean', async () => {
    await expect(syncDirtyRecords()).resolves.toEqual({ synced: 2, skipped: false });

    expect(saveProgressRemote).toHaveBeenCalledWith(expect.anything(), 'user_1', progress);
    expect(markProgressSynced).toHaveBeenCalledWith('college-board-question-bank', 'sha256_abc');
    expect(saveNoteRemote).toHaveBeenCalledWith(expect.anything(), 'user_1', note);
    expect(markNoteSynced).toHaveBeenCalledWith('college-board-question-bank', 'sha256_abc');
  });
});
