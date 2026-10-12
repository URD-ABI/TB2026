alter table public.challenges drop constraint challenges_event_id_display_order_key;
alter table public.challenges add constraint challenges_event_id_display_order_key unique (event_id, display_order) deferrable initially immediate;
alter table public.quiz_categories drop constraint quiz_categories_event_id_display_order_key;
alter table public.quiz_categories add constraint quiz_categories_event_id_display_order_key unique (event_id, display_order) deferrable initially immediate;
alter table public.quiz_answers drop constraint quiz_answers_question_id_fkey;
alter table public.quiz_answers add constraint quiz_answers_question_id_fkey foreign key (question_id) references public.quiz_questions(id) on delete restrict;

create or replace function public.update_challenge(
  p_event_id uuid, p_challenge_id uuid, p_title text, p_kind text, p_description text, p_image_path text
)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_old_image_path text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_kind), '') is null or nullif(btrim(p_description), '') is null then
    raise exception 'challenge_fields_required' using errcode = 'P0001';
  end if;
  if p_image_path is not null and p_image_path not like p_event_id::text || '/challenges/%.webp' then
    raise exception 'invalid_challenge_image_path' using errcode = 'P0001';
  end if;
  select image_path into v_old_image_path from public.challenges where id = p_challenge_id and event_id = p_event_id for update;
  if not found then raise exception 'challenge_event_mismatch' using errcode = 'P0001'; end if;
  if v_old_image_path is not null and v_old_image_path <> coalesce(p_image_path, '') and v_old_image_path like p_event_id::text || '/challenges/%.webp' then
    insert into public.media_cleanup_queue(event_id, path) values (p_event_id, v_old_image_path) on conflict do nothing;
  end if;
  if p_image_path is not null then delete from public.media_cleanup_queue where event_id = p_event_id and path = p_image_path; end if;
  update public.challenges set title = btrim(p_title), kind = btrim(p_kind), description = btrim(p_description), image_path = p_image_path
  where id = p_challenge_id and event_id = p_event_id;
end $$;

create or replace function public.reorder_challenges(p_event_id uuid, p_challenge_ids uuid[])
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select count(*) into v_count from public.challenges where event_id = p_event_id;
  if v_count <> 5 or cardinality(p_challenge_ids) <> 5
    or (select count(distinct id) from unnest(p_challenge_ids) ids(id)) <> 5
    or exists (select 1 from unnest(p_challenge_ids) ids(id) where not exists (select 1 from public.challenges c where c.id = ids.id and c.event_id = p_event_id)) then
    raise exception 'five_challenges_required' using errcode = 'P0001';
  end if;
  set constraints challenges_event_id_display_order_key deferred;
  update public.challenges c set display_order = ordered.position - 1 from unnest(p_challenge_ids) with ordinality ordered(id, position)
  where c.id = ordered.id and c.event_id = p_event_id;
end $$;

create or replace function public.get_admin_quiz_questions(p_event_id uuid)
returns table(id uuid, category_id uuid, prompt text, answer text, points integer, display_order integer)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query select q.id, q.category_id, q.prompt, a.answer, q.points, q.display_order
  from public.quiz_questions q join public.quiz_question_answers a on a.question_id = q.id
  join public.quiz_categories c on c.id = q.category_id where c.event_id = p_event_id
  order by c.display_order, q.display_order;
end $$;

create or replace function public.update_quiz_category(p_event_id uuid, p_category_id uuid, p_title text, p_image_path text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_old_image_path text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'category_title_required' using errcode = 'P0001'; end if;
  if p_image_path is not null and p_image_path not like p_event_id::text || '/quiz/%.webp' then raise exception 'invalid_category_image_path' using errcode = 'P0001'; end if;
  select image_path into v_old_image_path from public.quiz_categories where id = p_category_id and event_id = p_event_id for update;
  if not found then raise exception 'category_event_mismatch' using errcode = 'P0001'; end if;
  if v_old_image_path is not null and v_old_image_path <> coalesce(p_image_path, '') and v_old_image_path like p_event_id::text || '/quiz/%.webp' then
    insert into public.media_cleanup_queue(event_id, path) values (p_event_id, v_old_image_path) on conflict do nothing;
  end if;
  if p_image_path is not null then delete from public.media_cleanup_queue where event_id = p_event_id and path = p_image_path; end if;
  update public.quiz_categories set title = btrim(p_title), image_path = p_image_path where id = p_category_id and event_id = p_event_id;
end $$;

create or replace function public.reorder_quiz_categories(p_event_id uuid, p_category_ids uuid[])
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select count(*) into v_count from public.quiz_categories where event_id = p_event_id;
  if v_count <> 6 or cardinality(p_category_ids) <> 6
    or (select count(distinct id) from unnest(p_category_ids) ids(id)) <> 6
    or exists (select 1 from unnest(p_category_ids) ids(id) where not exists (select 1 from public.quiz_categories c where c.id = ids.id and c.event_id = p_event_id)) then
    raise exception 'six_categories_required' using errcode = 'P0001';
  end if;
  set constraints quiz_categories_event_id_display_order_key deferred;
  update public.quiz_categories c set display_order = ordered.position - 1 from unnest(p_category_ids) with ordinality ordered(id, position)
  where c.id = ordered.id and c.event_id = p_event_id;
end $$;

create or replace function public.create_quiz_question(
  p_question_id uuid, p_category_id uuid, p_prompt text, p_answer text, p_points integer, p_display_order integer
)
returns uuid language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if nullif(btrim(p_prompt), '') is null or nullif(btrim(p_answer), '') is null then raise exception 'question_fields_required' using errcode = 'P0001'; end if;
  if p_points <= 0 or p_display_order < 0 then raise exception 'invalid_question_values' using errcode = 'P0001'; end if;
  perform 1 from public.quiz_categories where id = p_category_id;
  if not found then raise exception 'category_not_found' using errcode = 'P0001'; end if;
  insert into public.quiz_questions(id, category_id, prompt, points, display_order) values (p_question_id, p_category_id, btrim(p_prompt), p_points, p_display_order);
  insert into public.quiz_question_answers(question_id, answer) values (p_question_id, btrim(p_answer));
  return p_question_id;
end $$;

create or replace function public.update_quiz_question(p_question_id uuid, p_category_id uuid, p_prompt text, p_answer text, p_points integer)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if nullif(btrim(p_prompt), '') is null or nullif(btrim(p_answer), '') is null then raise exception 'question_fields_required' using errcode = 'P0001'; end if;
  if p_points <= 0 then raise exception 'invalid_question_values' using errcode = 'P0001'; end if;
  update public.quiz_questions set prompt = btrim(p_prompt), points = p_points where id = p_question_id and category_id = p_category_id;
  if not found then raise exception 'question_category_mismatch' using errcode = 'P0001'; end if;
  update public.quiz_question_answers set answer = btrim(p_answer) where question_id = p_question_id;
  if not found then raise exception 'answer_missing' using errcode = 'P0001'; end if;
end $$;

create or replace function public.delete_quiz_question(p_question_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then raise exception 'question_already_used' using errcode = 'P0001'; end if;
  delete from public.quiz_questions where id = p_question_id;
  if not found then raise exception 'question_not_found' using errcode = 'P0001'; end if;
end $$;

create or replace function public.reorder_quiz_questions(p_category_id uuid, p_question_ids uuid[])
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select count(*) into v_count from public.quiz_questions where category_id = p_category_id;
  if cardinality(p_question_ids) <> v_count
    or (select count(distinct id) from unnest(p_question_ids) ids(id)) <> v_count
    or exists (select 1 from unnest(p_question_ids) ids(id) where not exists (select 1 from public.quiz_questions q where q.id = ids.id and q.category_id = p_category_id)) then
    raise exception 'invalid_question_order' using errcode = 'P0001';
  end if;
  update public.quiz_questions set display_order = display_order + v_count + 1000000 where category_id = p_category_id;
  update public.quiz_questions q set display_order = ordered.position - 1 from unnest(p_question_ids) with ordinality ordered(id, position)
  where q.id = ordered.id and q.category_id = p_category_id;
end $$;

revoke all on function public.update_challenge(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.reorder_challenges(uuid, uuid[]) from public, anon;
revoke all on function public.get_admin_quiz_questions(uuid) from public, anon;
revoke all on function public.update_quiz_category(uuid, uuid, text, text) from public, anon;
revoke all on function public.reorder_quiz_categories(uuid, uuid[]) from public, anon;
revoke all on function public.create_quiz_question(uuid, uuid, text, text, integer, integer) from public, anon;
revoke all on function public.update_quiz_question(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.delete_quiz_question(uuid) from public, anon;
revoke all on function public.reorder_quiz_questions(uuid, uuid[]) from public, anon;
grant execute on function public.update_challenge(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.reorder_challenges(uuid, uuid[]) to authenticated;
grant execute on function public.get_admin_quiz_questions(uuid) to authenticated;
grant execute on function public.update_quiz_category(uuid, uuid, text, text) to authenticated;
grant execute on function public.reorder_quiz_categories(uuid, uuid[]) to authenticated;
grant execute on function public.create_quiz_question(uuid, uuid, text, text, integer, integer) to authenticated;
grant execute on function public.update_quiz_question(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.delete_quiz_question(uuid) to authenticated;
grant execute on function public.reorder_quiz_questions(uuid, uuid[]) to authenticated;
