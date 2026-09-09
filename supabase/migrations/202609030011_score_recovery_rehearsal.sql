create or replace function public.get_score_history(p_event_id uuid)
returns table(id uuid, event_id uuid, team_id uuid, points_delta integer, keys_delta integer, source text, created_at timestamptz, reversed_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query select score.id, score.event_id, score.team_id, score.points_delta, score.keys_delta, score.source, score.created_at, score.reversed_at
  from public.score_events score where score.event_id = p_event_id order by score.created_at desc, score.id desc;
end $$;

create or replace function public.reverse_score_event(p_score_event_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_event_id uuid; v_score public.score_events%rowtype;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select event_id into v_event_id from public.score_events where id = p_score_event_id;
  if not found then raise exception 'score_event_not_found' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('score:' || v_event_id::text, 0));
  select * into v_score from public.score_events where id = p_score_event_id for update;
  if not found then raise exception 'score_event_not_found' using errcode = 'P0001'; end if;
  if v_score.reversed_at is not null then return; end if;
  update public.teams set points = points - v_score.points_delta, keys = keys - v_score.keys_delta, tie_break_priority = null
  where id = v_score.team_id and event_id = v_score.event_id;
  if not found then raise exception 'team_not_found' using errcode = 'P0001'; end if;
  update public.score_events set reversed_at = now() where id = p_score_event_id;
end $$;

create or replace function public.reset_rehearsal(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'event_not_found' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('quiz:' || p_event_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));
  delete from public.quiz_answers answer using public.quiz_sessions session where answer.session_id = session.id and session.event_id = p_event_id;
  delete from public.quiz_sessions where event_id = p_event_id;
  update public.quiz_categories set status = 'available', chosen_by_team_id = null where event_id = p_event_id;
  delete from public.score_events where event_id = p_event_id;
  update public.teams set points = 0, keys = 0, tie_break_priority = null where event_id = p_event_id;
  update public.participants set revealed_team_id = null, revealed_at = null where event_id = p_event_id;
end $$;

revoke all on function public.get_score_history(uuid) from public, anon;
revoke all on function public.reverse_score_event(uuid) from public, anon;
revoke all on function public.reset_rehearsal(uuid) from public, anon;
grant execute on function public.get_score_history(uuid) to authenticated;
grant execute on function public.reverse_score_event(uuid) to authenticated;
grant execute on function public.reset_rehearsal(uuid) to authenticated;
