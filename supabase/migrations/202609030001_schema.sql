create extension if not exists pgcrypto with schema extensions;

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default 'Team Building 2026',
  background_path text,
  quiz_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emblem text,
  display_order integer not null check (display_order between 0 and 4),
  points integer not null default 0,
  keys integer not null default 0 check (keys >= 0),
  tie_break_priority integer,
  unique (event_id, display_order)
);

create table public.score_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  points_delta integer not null,
  keys_delta integer not null,
  source text not null,
  idempotency_key uuid not null unique,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table public.participants (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  photo_path text,
  revealed_team_id uuid references public.teams(id) on delete set null,
  reveal_order integer not null check (reveal_order >= 0),
  revealed_at timestamptz,
  unique (event_id, reveal_order)
);

create table public.participant_assignments (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade
);

create table public.challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  kind text not null,
  description text not null,
  image_path text,
  display_order integer not null check (display_order between 0 and 4),
  unique (event_id, display_order)
);

create table public.quiz_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  image_path text,
  display_order integer not null check (display_order between 0 and 5),
  status text not null default 'available' check (status in ('available', 'played')),
  unique (event_id, display_order)
);

create table public.quiz_questions (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.quiz_categories(id) on delete cascade,
  prompt text not null,
  points integer not null check (points > 0),
  display_order integer not null check (display_order >= 0),
  unique (category_id, display_order)
);

create table public.quiz_question_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  answer text not null
);

create table public.quiz_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  team_order uuid[] not null default '{}'::uuid[],
  current_team_index integer not null default 0,
  active_category_id uuid references public.quiz_categories(id) on delete set null,
  active_question_index integer not null default 0,
  answer_visible boolean not null default false,
  revealed_answer text,
  started_at timestamptz
);

create table public.quiz_answers (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  correct boolean not null,
  score_event_id uuid references public.score_events(id) on delete set null,
  unique (session_id, question_id)
);

create index score_events_event_created_at_idx on public.score_events (event_id, created_at);
create index participants_next_reveal_idx on public.participants (event_id, reveal_order) where revealed_at is null;
