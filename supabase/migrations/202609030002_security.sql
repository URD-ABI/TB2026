create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.events enable row level security;
alter table public.admin_users enable row level security;
alter table public.teams enable row level security;
alter table public.score_events enable row level security;
alter table public.participants enable row level security;
alter table public.participant_assignments enable row level security;
alter table public.challenges enable row level security;
alter table public.quiz_categories enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_answers enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;

grant select on public.events, public.teams, public.participants, public.challenges, public.quiz_categories, public.quiz_questions, public.quiz_sessions to anon, authenticated;
-- RLS, not a permissions error, makes secret relations empty for browser roles.
grant select on public.admin_users, public.score_events, public.participant_assignments, public.quiz_question_answers, public.quiz_answers to anon;
grant select, insert, update, delete on public.events, public.admin_users, public.teams, public.score_events, public.participants, public.participant_assignments, public.challenges, public.quiz_categories, public.quiz_questions, public.quiz_question_answers, public.quiz_sessions, public.quiz_answers to authenticated;

create policy public_read_events on public.events for select to anon, authenticated using (true);
create policy public_read_teams on public.teams for select to anon, authenticated using (true);
create policy public_read_participants on public.participants for select to anon, authenticated using (true);
create policy public_read_challenges on public.challenges for select to anon, authenticated using (true);
create policy public_read_quiz_categories on public.quiz_categories for select to anon, authenticated using (true);
create policy public_read_quiz_questions on public.quiz_questions for select to anon, authenticated using (true);
create policy public_read_quiz_sessions on public.quiz_sessions for select to anon, authenticated using (true);

create policy admin_manage_events on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_admin_users on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_teams on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_score_events on public.score_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_participants on public.participants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_participant_assignments on public.participant_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_challenges on public.challenges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_quiz_categories on public.quiz_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_quiz_questions on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_quiz_question_answers on public.quiz_question_answers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_quiz_sessions on public.quiz_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_quiz_answers on public.quiz_answers for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do update set public = excluded.public;

create policy event_media_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'event-media');

create policy event_media_admin_write
on storage.objects for all to authenticated
using (bucket_id = 'event-media' and public.is_admin())
with check (bucket_id = 'event-media' and public.is_admin());
