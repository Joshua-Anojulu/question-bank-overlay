import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../config/env';

const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return typeof result[key] === 'string' ? result[key] : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
};

export function createSupabaseClient() {
  return createClient(getRequiredEnv('VITE_SUPABASE_URL'), getRequiredEnv('VITE_SUPABASE_ANON_KEY'), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: chromeStorageAdapter
    }
  });
}
