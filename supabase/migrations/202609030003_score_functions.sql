create or replace function public.apply_score_event(
  p_event_id uuid,
  p_team_id uuid,
  p_point_delta integer,
  p_key_delta integer,
  p_source text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_score_event_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Serialize retries for one idempotency key before inspecting or inserting it.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select id into v_score_event_id
  from public.score_events
  where idempotency_key = p_idempotency_key;

  if found then
    return v_score_event_id;
  end if;

  perform 1
  from public.teams
  where id = p_team_id
    and event_id = p_event_id
  for update;

  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
  end if;

  update public.teams
  set points = points + p_point_delta,
      keys = keys + p_key_delta,
      tie_break_priority = null
  where id = p_team_id
    and event_id = p_event_id;

  insert into public.score_events (
    event_id,
    team_id,
    points_delta,
    keys_delta,
    source,
    idempotency_key,
    created_by
  ) values (
    p_event_id,
    p_team_id,
    p_point_delta,
    p_key_delta,
    p_source,
    p_idempotency_key,
    auth.uid()
  )
  returning id into v_score_event_id;

  return v_score_event_id;
end;
$$;

create or replace function public.reveal_next_participant(p_event_id uuid)
returns table (participant_id uuid, team_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_participant_id uuid;
  v_team_id uuid;
begin
  select p.id into v_participant_id
  from public.participants p
  where p.event_id = p_event_id
    and p.revealed_at is null
  order by p.reveal_order
  for update skip locked
  limit 1;

  if not found then
    raise exception 'no_participant' using errcode = 'P0001';
  end if;

  select pa.team_id into v_team_id
  from public.participant_assignments pa
  join public.teams t on t.id = pa.team_id
  where pa.participant_id = v_participant_id
    and t.event_id = p_event_id;

  if not found then
    raise exception 'assignment_missing' using errcode = 'P0001';
  end if;

  update public.participants
  set revealed_team_id = v_team_id,
      revealed_at = now()
  where id = v_participant_id;

  return query select v_participant_id, v_team_id;
end;
$$;

revoke all on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) from public;
revoke all on function public.reveal_next_participant(uuid) from public;
grant execute on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) to authenticated;
grant execute on function public.reveal_next_participant(uuid) to anon, authenticated;
