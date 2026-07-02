import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage } from '../../src/background/messageRouter';
import { createSupabaseClient } from '../../src/sync/supabaseClient';

vi.mock('../../src/sync/supabaseClient', () => ({
  createSupabaseClient: vi.fn()
}));

vi.mock('../../src/sync/syncQueue', () => ({
  syncDirtyRecords: vi.fn().mockResolvedValue({ synced: 0, skipped: true })
}));

describe('handleMessage auth messages', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_1', email: 'j@example.com' } }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'user_1', email: 'j@example.com' } },
          error: null
        }),
        signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://auth.example.test/start' }, error: null }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { user: { id: 'user_1', email: 'j@example.com' } },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    } as never);

    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      identity: {
        getRedirectURL: vi.fn().mockReturnValue('https://extension.chromiumapp.org/supabase'),
        launchWebAuthFlow: vi.fn().mockResolvedValue('https://extension.chromiumapp.org/supabase?code=oauth_code')
      }
    } as never;
  });

  it('returns the current user', async () => {
    await expect(handleMessage({ type: 'auth:getUser' }, {})).resolves.toMatchObject({
      ok: true,
      user: { email: 'j@example.com' }
    });
  });

  it('signs in with email and password', async () => {
    const client = createSupabaseClient();

    await expect(
      handleMessage({ type: 'auth:signInWithPassword', email: 'j@example.com', password: 'secret' }, {})
    ).resolves.toMatchObject({ ok: true, user: { email: 'j@example.com' } });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'j@example.com', password: 'secret' });
  });

  it('uses chrome identity for Google OAuth and exchanges the returned code', async () => {
    const client = createSupabaseClient();

    await expect(handleMessage({ type: 'auth:signInWithGoogle' }, {})).resolves.toMatchObject({
      ok: true,
      user: { email: 'j@example.com' }
    });
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://extension.chromiumapp.org/supabase', skipBrowserRedirect: true }
    });
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith({
      url: 'https://auth.example.test/start',
      interactive: true
    });
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth_code');
  });

  it('signs out', async () => {
    await expect(handleMessage({ type: 'auth:signOut' }, {})).resolves.toEqual({ ok: true });
  });
});
