import type { QuestionMetadata, QuestionProgress, StudyStatus } from '../shared/types';
import type { AnswerType } from './answerDetector';

export function createInitialProgress(metadata: QuestionMetadata, now: string): QuestionProgress {
  return {
    ...metadata,
    status: 'unseen',
    lastResult: null,
    attemptCount: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    updatedAt: now
  };
}

export function updateProgressStatus(
  progress: QuestionProgress,
  status: StudyStatus,
  now: string
): QuestionProgress {
  const isAttemptResult = status === 'correct' || status === 'missed' || status === 'unsure';

  return {
    ...progress,
    status,
    lastResult: isAttemptResult ? status : null,
    attemptCount: isAttemptResult ? progress.attemptCount + 1 : progress.attemptCount,
    lastSeenAt: now,
    updatedAt: now
  };
}

export function recordAnswer(
  progress: QuestionProgress,
  input: { selectedAnswer: string; type: AnswerType; isCorrect: boolean },
  now: string
): QuestionProgress {
  return {
    ...progress,
    status: input.isCorrect ? 'correct' : 'missed',
    lastResult: input.isCorrect ? 'correct' : 'missed',
    attemptCount: progress.attemptCount + 1,
    selectedAnswer: input.selectedAnswer,
    answeredAt: now,
    lastSeenAt: now,
    updatedAt: now
  };
}
