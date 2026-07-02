import { toNotePayload, toProgressPayload } from '../shared/syncPayload';
import type { QuestionNote, QuestionProgress } from '../shared/types';

type UpsertResult = PromiseLike<{ error: Error | { message?: string } | null }>;

type SupabaseLike = {
  from(table: string): {
    upsert(payload: unknown, options: { onConflict: string }): UpsertResult;
  };
};

export async function saveProgressRemote(
  client: SupabaseLike,
  userId: string,
  progress: QuestionProgress
): Promise<void> {
  const { error } = await client
    .from('question_progress')
    .upsert(toProgressPayload(userId, progress), { onConflict: 'user_id,source,question_key' });

  if (error) throwRemoteError(error);
}

export async function saveNoteRemote(client: SupabaseLike, userId: string, note: QuestionNote): Promise<void> {
  const { error } = await client
    .from('question_notes')
    .upsert(toNotePayload(userId, note), { onConflict: 'user_id,source,question_key' });

  if (error) throwRemoteError(error);
}

function throwRemoteError(error: Error | { message?: string }): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message ?? 'REMOTE_WRITE_FAILED');
}
