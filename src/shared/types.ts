export type QuestionSource = 'college-board-question-bank';
export type QuestionKeyMethod = 'visible-id' | 'fingerprint';
export type StudyStatus = 'unseen' | 'done' | 'correct' | 'missed' | 'unsure' | 'review';
export type LastResult = 'correct' | 'missed' | 'unsure' | null;
export type SyncState = 'saved' | 'saving' | 'offline' | 'sync-delayed' | 'needs-sign-in';

export interface QuestionMetadata {
  source: QuestionSource;
  questionKey: string;
  questionKeyMethod: QuestionKeyMethod;
  section: string | null;
  domain: string | null;
  skill: string | null;
  difficulty: string | null;
}

export interface QuestionProgress extends QuestionMetadata {
  status: StudyStatus;
  lastResult: LastResult;
  attemptCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  selectedAnswer?: string | null;
  answeredAt?: string | null;
}

export interface QuestionNote {
  source: QuestionSource;
  questionKey: string;
  note: string;
  updatedAt: string;
}

export interface ProgressPayload {
  user_id: string;
  source: QuestionSource;
  question_key: string;
  question_key_method: QuestionKeyMethod;
  section: string | null;
  domain: string | null;
  skill: string | null;
  difficulty: string | null;
  status: StudyStatus;
  last_result: LastResult;
  attempt_count: number;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
  selected_answer?: string | null;
  answered_at?: string | null;
}

export interface NotePayload {
  user_id: string;
  source: QuestionSource;
  question_key: string;
  note: string;
  updated_at: string;
}
