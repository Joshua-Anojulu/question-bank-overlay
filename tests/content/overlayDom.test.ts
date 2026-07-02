import { describe, expect, it, vi } from 'vitest';
import { mountOverlay } from '../../src/content/overlayDom';
import type { QuestionMetadata, QuestionProgress } from '../../src/shared/types';

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('waitFor timed out');
}

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

  it('re-detects when the SPA opens a question after the panel has mounted', async () => {
    const host = document.createElement('div');
    const detect = vi.fn()
      .mockResolvedValueOnce(null) // nothing open when the panel first mounts
      .mockResolvedValue(metadata); // a question is opened afterwards
    const sendMessage = vi.fn(async (msg: { type: string }) => {
      if (msg.type === 'progress:get') return { ok: true, progress: null };
      if (msg.type === 'note:get') return { ok: true, note: null };
      return { ok: true };
    });

    const controller = mountOverlay(host, {
      detect,
      sendMessage: sendMessage as never,
      now: () => '2026-07-01T10:00:00.000Z',
      redetectDelayMs: 0
    });
    await controller.ready;
    expect(host.textContent).toContain('Question not recognized on this page.');

    // Simulate the SPA rendering a question into the page.
    document.body.appendChild(document.createElement('div'));

    await waitFor(() => host.querySelector('button[data-status="correct"]') !== null);
    expect(host.textContent).toContain('Math');

    controller.destroy();
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
