import {
  listDirtyNotes,
  listDirtyProgress,
  markNoteSynced,
  markProgressSynced
} from '../storage/localDb';
import { saveNoteRemote, saveProgressRemote } from './progressRepository';
import { createSupabaseClient } from './supabaseClient';

export async function syncDirtyRecords(): Promise<{ synced: number; skipped: boolean }> {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.getUser();
  const userId = error ? null : data.user?.id;

  if (!userId) return { synced: 0, skipped: true };

  let synced = 0;
  const dirtyProgress = await listDirtyProgress();
  for (const progress of dirtyProgress) {
    await saveProgressRemote(client, userId, progress);
    await markProgressSynced(progress.source, progress.questionKey);
    synced += 1;
  }

  const dirtyNotes = await listDirtyNotes();
  for (const note of dirtyNotes) {
    await saveNoteRemote(client, userId, note);
    await markNoteSynced(note.source, note.questionKey);
    synced += 1;
  }

  return { synced, skipped: false };
}

export const syncDirtyProgress = syncDirtyRecords;
