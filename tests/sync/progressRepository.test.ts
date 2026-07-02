import { describe, expect, it, vi } from 'vitest';
import { saveNoteRemote, saveProgressRemote } from '../../src/sync/progressRepository';
import type { QuestionNote, QuestionProgress } from '../../src/shared/types';

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

describe('progressRepository', () => {
  it('upserts progress without raw question content', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });

    await saveProgressRemote({ from }, 'user_1', progress);

    expect(from).toHaveBeenCalledWith('question_progress');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user_1', question_key: 'sha256_abc' }),
      { onConflict: 'user_id,source,question_key' }
    );
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toContain('prompt');
  });

  it('upserts private notes by user, source, and question key', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });

    await saveNoteRemote({ from }, 'user_1', note);

    expect(from).toHaveBeenCalledWith('question_notes');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user_1', question_key: 'sha256_abc', note: 'Review why I picked B.' }),
      { onConflict: 'user_id,source,question_key' }
    );
  });

  it('throws remote errors so the sync queue keeps records dirty', async () => {
    const error = new Error('network down');
    const upsert = vi.fn().mockResolvedValue({ error });
    const from = vi.fn().mockReturnValue({ upsert });

    await expect(saveProgressRemote({ from }, 'user_1', progress)).rejects.toThrow('network down');
  });
});
