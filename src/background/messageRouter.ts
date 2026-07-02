import { getLocalNote, getLocalProgress, upsertLocalNote, upsertLocalProgress } from '../storage/localDb';
import { syncDirtyRecords } from '../sync/syncQueue';
import { createSupabaseClient } from '../sync/supabaseClient';
import type { QuestionNote, QuestionProgress, QuestionSource } from '../shared/types';

type RuntimeMessage =
  | { type: 'progress:get'; source: QuestionSource; questionKey: string }
  | { type: 'progress:save'; progress: QuestionProgress }
  | { type: 'note:get'; source: QuestionSource; questionKey: string }
  | { type: 'note:save'; note: QuestionNote }
  | { type: 'sync:flush' }
  | { type: 'auth:getUser' }
  | { type: 'auth:signInWithPassword'; email: string; password: string }
  | { type: 'auth:signInWithGoogle' }
  | { type: 'auth:signOut' };

type Sender = chrome.runtime.MessageSender | Record<string, never>;

export async function handleMessage(message: RuntimeMessage, _sender: Sender) {
  if (message.type === 'progress:get') {
    const progress = await getLocalProgress(message.source, message.questionKey);
    return { ok: true, progress };
  }

  if (message.type === 'progress:save') {
    await upsertLocalProgress(message.progress);
    syncDirtyRecords().catch((error: unknown) => console.warn('Sync delayed', error));
    return { ok: true };
  }

  if (message.type === 'note:get') {
    const note = await getLocalNote(message.source, message.questionKey);
    return { ok: true, note };
  }

  if (message.type === 'note:save') {
    await upsertLocalNote(message.note);
    syncDirtyRecords().catch((error: unknown) => console.warn('Sync delayed', error));
    return { ok: true };
  }

  if (message.type === 'sync:flush') {
    const result = await syncDirtyRecords();
    return { ok: true, result };
  }

  if (message.type === 'auth:getUser') {
    const client = createSupabaseClient();
    const { data, error } = await client.auth.getUser();
    return error ? { ok: false, error: error.message } : { ok: true, user: data.user };
  }

  if (message.type === 'auth:signInWithPassword') {
    const client = createSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: message.email,
      password: message.password
    });
    return error ? { ok: false, error: error.message } : { ok: true, user: data.user };
  }

  if (message.type === 'auth:signInWithGoogle') {
    const client = createSupabaseClient();
    const redirectTo = chrome.identity.getRedirectURL('supabase');
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error || !data.url) return { ok: false, error: error?.message ?? 'GOOGLE_AUTH_URL_MISSING' };

    const callbackUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    if (!callbackUrl) return { ok: false, error: 'GOOGLE_AUTH_CALLBACK_MISSING' };

    const code = new URL(callbackUrl).searchParams.get('code');
    if (!code) return { ok: false, error: 'GOOGLE_AUTH_CODE_MISSING' };

    const sessionResult = await client.auth.exchangeCodeForSession(code);
    return sessionResult.error
      ? { ok: false, error: sessionResult.error.message }
      : { ok: true, user: sessionResult.data.user };
  }

  if (message.type === 'auth:signOut') {
    const client = createSupabaseClient();
    const { error } = await client.auth.signOut();
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  return { ok: false, error: 'UNKNOWN_MESSAGE' };
}
