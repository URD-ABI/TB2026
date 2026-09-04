do $$
declare
  v_table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'supabase_realtime publication is required';
  end if;

  foreach v_table_name in array array[
    'events',
    'teams',
    'participants',
    'challenges',
    'quiz_categories',
    'quiz_sessions'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end;
$$;

-- PostgreSQL does not permit CREATE OR REPLACE to rename input parameters.
drop function if exists public.apply_score_event(uuid, uuid, integer, integer, text, uuid);

create function public.apply_score_event(
  p_event_id uuid,
  p_team_id uuid,
  p_points integer,
  p_keys integer,
  p_reason text,
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
  set points = points + p_points,
      keys = keys + p_keys,
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
    p_points,
    p_keys,
    p_reason,
    p_idempotency_key,
    auth.uid()
  )
  returning id into v_score_event_id;

  return v_score_event_id;
end;
$$;

comment on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid)
is 'Applies an idempotent administrator score change and records its reason.';

revoke all on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) from public;
grant execute on function public.apply_score_event(uuid, uuid, integer, integer, text, uuid) to authenticated;
