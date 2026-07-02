import { describe, expect, it, vi } from 'vitest';
import { mountOverlay } from '../../src/content/overlayDom';
import type { QuestionMetadata, QuestionProgress } from '../../src/shared/types';

const metadata: QuestionMetadata = {
  source: 'college-board-question-bank',
  questionKey: 'sha256_abc',
  questionKeyMethod: 'fingerprint',
  section: 'Math',
  domain: 'Algebra',
  skill: 'Linear equations',
  difficulty: 'Hard'
};

const progress: QuestionProgress = {
  ...metadata,
  status: 'unseen',
  lastResult: null,
  attemptCount: 0,
  firstSeenAt: '2026-07-01T10:00:00.000Z',
  lastSeenAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z'
};

describe('mountOverlay', () => {
  it('renders an unsupported-page message when no question is detected', async () => {
    const host = document.createElement('div');
    const controller = mountOverlay(host, {
      detect: vi.fn().mockResolvedValue(null),
      sendMessage: vi.fn(),
      now: () => '2026-07-01T10:00:00.000Z'
    });

    await controller.ready;

    expect(host.textContent).toContain('Question not recognized on this page.');
  });

  it('saves a status update through the background router', async () => {
    const host = document.createElement('div');
    const sendMessage = vi.fn()
      .mockResolvedValueOnce({ ok: true, progress })
      .mockResolvedValueOnce({ ok: true, note: null })
      .mockResolvedValue({ ok: true });

    const controller = mountOverlay(host, {
      detect: vi.fn().mockResolvedValue(metadata),
      sendMessage,
      now: () => '2026-07-01T10:01:00.000Z'
    });
    await controller.ready;

    host.querySelector<HTMLButtonElement>('button[data-status="correct"]')?.click();
    await Promise.resolve();

    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'progress:save',
      progress: expect.objectContaining({
        status: 'correct',
        lastResult: 'correct',
        attemptCount: 1
      })
    });
  });
});
