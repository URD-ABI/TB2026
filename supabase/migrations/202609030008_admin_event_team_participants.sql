create or replace function public.reorder_participants(
  p_event_id uuid,
  p_participant_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_expected_count integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_expected_count
  from public.participants
  where event_id = p_event_id;

  if cardinality(p_participant_ids) <> v_expected_count
    or (select count(distinct id) from unnest(p_participant_ids) as ids(id)) <> v_expected_count
    or exists (
      select 1 from unnest(p_participant_ids) as ids(id)
      where not exists (
        select 1 from public.participants p
        where p.id = ids.id and p.event_id = p_event_id
      )
    ) then
    raise exception 'invalid_participant_order' using errcode = 'P0001';
  end if;

  -- Move existing values out of the target range before assigning contiguous slots.
  update public.participants
  set reveal_order = reveal_order + v_expected_count + 1000000
  where event_id = p_event_id;

  update public.participants p
  set reveal_order = ordered.position - 1
  from unnest(p_participant_ids) with ordinality as ordered(id, position)
  where p.id = ordered.id
    and p.event_id = p_event_id;
end;
$$;

create or replace function public.reset_participant_reveals(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.participants
  set revealed_at = null,
      revealed_team_id = null
  where event_id = p_event_id;
end;
$$;

create or replace function public.set_team_tie_break_order(
  p_event_id uuid,
  p_team_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if cardinality(p_team_ids) < 2
    or (select count(distinct id) from unnest(p_team_ids) as ids(id)) <> cardinality(p_team_ids)
    or exists (
      select 1 from unnest(p_team_ids) as ids(id)
      where not exists (
        select 1 from public.teams t where t.id = ids.id and t.event_id = p_event_id
      )
    ) then
    raise exception 'invalid_tie_break_order' using errcode = 'P0001';
  end if;

  update public.teams
  set tie_break_priority = null
  where event_id = p_event_id;

  update public.teams t
  set tie_break_priority = ordered.position
  from unnest(p_team_ids) with ordinality as ordered(id, position)
  where t.id = ordered.id
    and t.event_id = p_event_id;
end;
$$;

revoke all on function public.reorder_participants(uuid, uuid[]) from public, anon;
revoke all on function public.reset_participant_reveals(uuid) from public, anon;
revoke all on function public.set_team_tie_break_order(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_participants(uuid, uuid[]) to authenticated;
grant execute on function public.reset_participant_reveals(uuid) to authenticated;
grant execute on function public.set_team_tie_break_order(uuid, uuid[]) to authenticated;

drop policy if exists event_media_admin_write on storage.objects;
create policy event_media_admin_write
on storage.objects for all to authenticated
using (
  bucket_id = 'event-media'
  and public.is_admin()
  and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'event-media'
  and public.is_admin()
  and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[1]
  )
);
