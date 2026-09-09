create table public.media_cleanup_queue (
  event_id uuid not null references public.events(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, path),
  constraint media_cleanup_path_scoped check (
    path like event_id::text || '/%'
    and path not like '%/../%'
    and path not like '%/./%'
  )
);

alter table public.media_cleanup_queue enable row level security;
revoke all on public.media_cleanup_queue from public, anon, authenticated;

create or replace function public.queue_media_cleanup(p_event_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if nullif(p_path, '') is null
    or p_path not like p_event_id::text || '/%'
    or p_path like '%/../%'
    or p_path like '%/./%' then
    raise exception 'invalid_media_cleanup_path' using errcode = 'P0001';
  end if;

  insert into public.media_cleanup_queue (event_id, path)
  values (p_event_id, p_path)
  on conflict do nothing;
end;
$$;

create or replace function public.list_media_cleanup(p_event_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_paths text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(array_agg(path order by created_at, path), array[]::text[])
  into v_paths
  from public.media_cleanup_queue
  where event_id = p_event_id;
  return v_paths;
end;
$$;

create or replace function public.ack_media_cleanup(p_event_id uuid, p_paths text[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_paths, array[]::text[])) as requested(path)
    where requested.path not like p_event_id::text || '/%'
      or requested.path like '%/../%'
      or requested.path like '%/./%'
  ) then
    raise exception 'invalid_media_cleanup_path' using errcode = 'P0001';
  end if;

  delete from public.media_cleanup_queue
  where event_id = p_event_id
    and path = any(coalesce(p_paths, array[]::text[]));
end;
$$;

create or replace function public.update_event(
  p_event_id uuid,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_background_path text,
  p_quiz_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_background_path text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if nullif(btrim(p_slug), '') is null or nullif(btrim(p_title), '') is null then
    raise exception 'event_fields_required' using errcode = 'P0001';
  end if;
  if p_background_path is not null
    and (p_background_path not like p_event_id::text || '/%'
      or p_background_path like '%/../%'
      or p_background_path like '%/./%') then
    raise exception 'invalid_event_background_path' using errcode = 'P0001';
  end if;

  select background_path into v_old_background_path
  from public.events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  if v_old_background_path is not null
    and v_old_background_path <> coalesce(p_background_path, '')
    and v_old_background_path like p_event_id::text || '/%'
    and v_old_background_path not like '%/../%'
    and v_old_background_path not like '%/./%' then
    insert into public.media_cleanup_queue (event_id, path)
    values (p_event_id, v_old_background_path)
    on conflict do nothing;
  end if;

  if p_background_path is not null then
    delete from public.media_cleanup_queue
    where event_id = p_event_id and path = p_background_path;
  end if;

  update public.events
  set slug = btrim(p_slug),
      title = btrim(p_title),
      subtitle = btrim(p_subtitle),
      background_path = p_background_path,
      quiz_enabled = p_quiz_enabled
  where id = p_event_id;
end;
$$;

create or replace function public.update_participant(
  p_event_id uuid,
  p_participant_id uuid,
  p_name text,
  p_photo_path text,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_photo_path text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'participant_name_required' using errcode = 'P0001';
  end if;
  if p_photo_path is not null
    and p_photo_path not like p_event_id::text || '/participants/%.webp' then
    raise exception 'invalid_participant_photo_path' using errcode = 'P0001';
  end if;

  select photo_path into v_old_photo_path
  from public.participants
  where id = p_participant_id and event_id = p_event_id
  for update;
  if not found then
    raise exception 'participant_event_mismatch' using errcode = 'P0001';
  end if;

  perform 1 from public.teams
  where id = p_team_id and event_id = p_event_id;
  if not found then
    raise exception 'team_event_mismatch' using errcode = 'P0001';
  end if;

  if v_old_photo_path is not null
    and v_old_photo_path <> coalesce(p_photo_path, '')
    and v_old_photo_path like p_event_id::text || '/participants/%.webp' then
    insert into public.media_cleanup_queue (event_id, path)
    values (p_event_id, v_old_photo_path)
    on conflict do nothing;
  end if;
  if p_photo_path is not null then
    delete from public.media_cleanup_queue
    where event_id = p_event_id and path = p_photo_path;
  end if;

  update public.participants
  set name = btrim(p_name), photo_path = p_photo_path
  where id = p_participant_id and event_id = p_event_id;

  insert into public.participant_assignments (participant_id, team_id)
  values (p_participant_id, p_team_id)
  on conflict (participant_id) do update set team_id = excluded.team_id;
end;
$$;

create or replace function public.delete_participant(
  p_event_id uuid,
  p_participant_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_photo_path text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select photo_path into v_photo_path
  from public.participants
  where id = p_participant_id and event_id = p_event_id
  for update;
  if not found then
    return null;
  end if;
  if v_photo_path is not null
    and v_photo_path not like p_event_id::text || '/participants/%.webp' then
    raise exception 'invalid_participant_photo_path' using errcode = 'P0001';
  end if;

  if v_photo_path is not null then
    insert into public.media_cleanup_queue (event_id, path)
    values (p_event_id, v_photo_path)
    on conflict do nothing;
  end if;
  delete from public.participants
  where id = p_participant_id and event_id = p_event_id;
  return v_photo_path;
end;
$$;

revoke all on function public.queue_media_cleanup(uuid, text) from public, anon;
revoke all on function public.list_media_cleanup(uuid) from public, anon;
revoke all on function public.ack_media_cleanup(uuid, text[]) from public, anon;
revoke all on function public.update_event(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.queue_media_cleanup(uuid, text) to authenticated;
grant execute on function public.list_media_cleanup(uuid) to authenticated;
grant execute on function public.ack_media_cleanup(uuid, text[]) to authenticated;
grant execute on function public.update_event(uuid, text, text, text, text, boolean) to authenticated;
