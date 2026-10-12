alter table public.events
  add column score_capacity integer not null default 100
  constraint events_score_capacity_positive check (score_capacity > 0);

drop function if exists public.update_event(uuid, text, text, text, text, boolean);

create function public.update_event(
  p_event_id uuid,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_background_path text,
  p_quiz_enabled boolean,
  p_score_capacity integer
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
  if p_score_capacity is null or p_score_capacity <= 0 then
    raise exception 'score_capacity_must_be_positive' using errcode = 'P0001';
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
      quiz_enabled = p_quiz_enabled,
      score_capacity = p_score_capacity
  where id = p_event_id;
end;
$$;

revoke all on function public.update_event(uuid, text, text, text, text, boolean, integer) from public, anon;
grant execute on function public.update_event(uuid, text, text, text, text, boolean, integer) to authenticated;
