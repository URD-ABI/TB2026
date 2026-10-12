-- PostgreSQL does not permit CREATE OR REPLACE to rename or replace the
-- overloads used by these RPC contracts, so recreate each explicit signature.
drop function if exists public.apply_score_event(uuid, uuid, integer, integer, text, uuid);

create function public.apply_score_event(
  p_event_id uuid,
  p_team_id uuid,
  p_points integer,
  p_keys integer,
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

  -- Serialize requests sharing a key before inspecting or creating its history row.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  -- Clearing every event tie-break locks multiple teams, so serialize score writes per event.
  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));

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

  -- A score invalidates every manual tie-break choice in this event.
  update public.teams
  set tie_break_priority = null
  where event_id = p_event_id;

  update public.teams
  set points = points + p_points,
      keys = keys + p_keys
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
    p_points,
    p_keys,
    p_source,
    p_idempotency_key,
    auth.uid()
  )
  returning id into v_score_event_id;

  return v_score_event_id;
end;
$$;

comment on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid)
is 'Applies an idempotent administrator score change, clears event tie-breaks, and records its source.';

revoke all on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) from public;
grant execute on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) to authenticated;

drop function if exists public.reveal_next_participant(uuid);
drop function if exists public.reveal_next_participant(uuid, uuid);

create function public.reveal_next_participant(
  p_event_id uuid,
  p_participant_id uuid
)
returns table (participant_id uuid, team_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_revealed_at timestamptz;
  v_team_id uuid;
  v_first_participant_id uuid;
begin
  -- One event-level lock makes a displayed participant retry deterministic.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  select p.revealed_at, p.revealed_team_id
  into v_revealed_at, v_team_id
  from public.participants p
  where p.id = p_participant_id
    and p.event_id = p_event_id
  for update;

  if not found then
    raise exception 'no_participant' using errcode = 'P0001';
  end if;

  if v_revealed_at is not null then
    return query select p_participant_id, v_team_id;
    return;
  end if;

  select p.id into v_first_participant_id
  from public.participants p
  where p.event_id = p_event_id
    and p.revealed_at is null
  order by p.reveal_order
  for update
  limit 1;

  if not found then
    raise exception 'no_participant' using errcode = 'P0001';
  end if;

  if v_first_participant_id <> p_participant_id then
    raise exception 'not_next_participant' using errcode = 'P0001';
  end if;

  select pa.team_id into v_team_id
  from public.participant_assignments pa
  join public.teams t on t.id = pa.team_id
  where pa.participant_id = p_participant_id
    and t.event_id = p_event_id;

  if not found then
    raise exception 'assignment_missing' using errcode = 'P0001';
  end if;

  update public.participants
  set revealed_team_id = v_team_id,
      revealed_at = now()
  where id = p_participant_id;

  return query select p_participant_id, v_team_id;
end;
$$;

revoke all on function public.reveal_next_participant(uuid, uuid) from public;
grant execute on function public.reveal_next_participant(uuid, uuid) to anon, authenticated;
