create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.question_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  question_key text not null,
  question_key_method text not null check (question_key_method in ('visible-id', 'fingerprint')),
  section text,
  domain text,
  skill text,
  difficulty text,
  status text not null check (status in ('unseen', 'done', 'correct', 'missed', 'unsure', 'review')),
  last_result text check (last_result is null or last_result in ('correct', 'missed', 'unsure')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, source, question_key)
);

create table if not exists public.question_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  question_key text not null,
  note text not null check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  unique (user_id, source, question_key)
);

create table if not exists public.filter_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null check (source = 'college-board-question-bank'),
  filters_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source = 'college-board-question-bank'),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seen_count integer not null default 0 check (seen_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  missed_count integer not null default 0 check (missed_count >= 0),
  unsure_count integer not null default 0 check (unsure_count >= 0),
  review_count integer not null default 0 check (review_count >= 0)
);

alter table public.profiles enable row level security;
alter table public.question_progress enable row level security;
alter table public.question_notes enable row level security;
alter table public.filter_presets enable row level security;
alter table public.study_sessions enable row level security;

create policy "profiles are user scoped" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "question progress is user scoped" on public.question_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "question notes are user scoped" on public.question_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "filter presets are user scoped" on public.filter_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "study sessions are user scoped" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
