import type { NotePayload, ProgressPayload, QuestionNote, QuestionProgress } from './types';

export function toProgressPayload(userId: string, progress: QuestionProgress): ProgressPayload {
  return {
    user_id: userId,
    source: progress.source,
    question_key: progress.questionKey,
    question_key_method: progress.questionKeyMethod,
    section: progress.section,
    domain: progress.domain,
    skill: progress.skill,
    difficulty: progress.difficulty,
    status: progress.status,
    last_result: progress.lastResult,
    attempt_count: progress.attemptCount,
    first_seen_at: progress.firstSeenAt,
    last_seen_at: progress.lastSeenAt,
    updated_at: progress.updatedAt
  };
}

export function toNotePayload(userId: string, note: QuestionNote): NotePayload {
  return {
    user_id: userId,
    source: note.source,
    question_key: note.questionKey,
    note: note.note,
    updated_at: note.updatedAt
  };
}
