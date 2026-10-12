create or replace function public.reset_quiz(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('quiz:' || p_event_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));

  update public.teams team
  set points = team.points - quiz_scores.points
  from (
    select score.team_id, sum(score.points_delta)::integer as points
    from public.score_events score
    where score.event_id = p_event_id
      and score.source = 'quiz'
      and score.reversed_at is null
    group by score.team_id
  ) quiz_scores
  where team.id = quiz_scores.team_id
    and team.event_id = p_event_id;

  delete from public.quiz_answers answer
  using public.quiz_sessions session
  where answer.session_id = session.id
    and session.event_id = p_event_id;
  delete from public.quiz_sessions where event_id = p_event_id;
  update public.quiz_categories
  set status = 'available', chosen_by_team_id = null
  where event_id = p_event_id;
  delete from public.score_events where event_id = p_event_id and source = 'quiz';
  update public.events set quiz_enabled = false where id = p_event_id;
end;
$$;

revoke all on function public.reset_quiz(uuid) from public, anon;
grant execute on function public.reset_quiz(uuid) to authenticated;
