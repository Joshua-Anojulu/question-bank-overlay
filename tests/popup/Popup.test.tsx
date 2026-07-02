import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Popup } from '../../src/popup/Popup';

describe('Popup', () => {
  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ ok: true, user: null })
      }
    } as never;
  });

  it('shows sign-in controls when no user is signed in', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);

    await act(async () => {
      root.render(<Popup />);
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'auth:getUser' });
    expect(host.querySelector('input[type="email"]')).not.toBeNull();
    expect(host.textContent).toContain('Continue with Google');

    await act(async () => root.unmount());
  });
});
