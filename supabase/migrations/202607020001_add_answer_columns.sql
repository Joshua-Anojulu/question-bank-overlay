alter table public.question_progress
  add column if not exists selected_answer text,
  add column if not exists answered_at timestamptz;
