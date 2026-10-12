create or replace function public.assert_valid_quiz_choices(p_choices jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
  v_distinct_ids integer;
  v_distinct_texts integer;
  v_distinct_positions integer;
  v_correct_count integer;
begin
  if jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) <> 4 then
    raise exception 'four_choices_required' using errcode = 'P0001';
  end if;

  select count(*), count(distinct item.id), count(distinct lower(btrim(item.text))),
         count(distinct item."displayOrder"), count(*) filter (where item."isCorrect")
  into v_count, v_distinct_ids, v_distinct_texts, v_distinct_positions, v_correct_count
  from jsonb_to_recordset(p_choices) as item(id uuid, text text, "displayOrder" integer, "isCorrect" boolean)
  where nullif(btrim(item.text), '') is not null
    and item."displayOrder" between 0 and 3
    and item."isCorrect" is not null;

  if v_count <> 4 then
    raise exception 'four_choices_required' using errcode = 'P0001';
  end if;
  if v_distinct_ids <> 4 or v_distinct_positions <> 4 or v_distinct_texts <> 4 then
    raise exception 'choices_must_be_distinct' using errcode = 'P0001';
  end if;
  if v_correct_count <> 1 then
    raise exception 'one_correct_choice_required' using errcode = 'P0001';
  end if;
end;
$$;

drop function public.get_admin_quiz_questions(uuid);
drop function public.create_quiz_question(uuid, uuid, text, text, integer, integer);
drop function public.update_quiz_question(uuid, uuid, text, text, integer);

create function public.get_admin_quiz_questions(p_event_id uuid)
returns table (
  id uuid,
  category_id uuid,
  prompt text,
  points integer,
  display_order integer,
  choices jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select question.id, question.category_id, question.prompt, question.points, question.display_order,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', choice.id,
        'questionId', choice.question_id,
        'text', choice.choice_text,
        'displayOrder', choice.display_order,
        'isCorrect', choice.is_correct
      ) order by choice.display_order)
      from public.quiz_question_choices choice
      where choice.question_id = question.id
    ), '[]'::jsonb)
  from public.quiz_questions question
  join public.quiz_categories category on category.id = question.category_id
  where category.event_id = p_event_id
  order by category.display_order, question.display_order;
end;
$$;

create function public.create_quiz_question(
  p_question_id uuid,
  p_category_id uuid,
  p_prompt text,
  p_points integer,
  p_display_order integer,
  p_choices jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if nullif(btrim(p_prompt), '') is null then
    raise exception 'question_fields_required' using errcode = 'P0001';
  end if;
  if p_points <= 0 or p_display_order < 0 then
    raise exception 'invalid_question_values' using errcode = 'P0001';
  end if;
  perform 1 from public.quiz_categories where id = p_category_id;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0001';
  end if;
  perform public.assert_valid_quiz_choices(p_choices);

  insert into public.quiz_questions(id, category_id, prompt, points, display_order)
  values (p_question_id, p_category_id, btrim(p_prompt), p_points, p_display_order);

  insert into public.quiz_question_choices(id, question_id, choice_text, display_order, is_correct)
  select item.id, p_question_id, btrim(item.text), item."displayOrder", item."isCorrect"
  from jsonb_to_recordset(p_choices) as item(id uuid, text text, "displayOrder" integer, "isCorrect" boolean);

  return p_question_id;
end;
$$;

create function public.update_quiz_question(
  p_question_id uuid,
  p_category_id uuid,
  p_prompt text,
  p_points integer,
  p_choices jsonb
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
  if nullif(btrim(p_prompt), '') is null then
    raise exception 'question_fields_required' using errcode = 'P0001';
  end if;
  if p_points <= 0 then
    raise exception 'invalid_question_values' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then
    raise exception 'question_already_used' using errcode = 'P0001';
  end if;
  perform public.assert_valid_quiz_choices(p_choices);

  update public.quiz_questions
  set prompt = btrim(p_prompt), points = p_points
  where id = p_question_id and category_id = p_category_id;
  if not found then
    raise exception 'question_category_mismatch' using errcode = 'P0001';
  end if;

  delete from public.quiz_question_choices where question_id = p_question_id;
  insert into public.quiz_question_choices(id, question_id, choice_text, display_order, is_correct)
  select item.id, p_question_id, btrim(item.text), item."displayOrder", item."isCorrect"
  from jsonb_to_recordset(p_choices) as item(id uuid, text text, "displayOrder" integer, "isCorrect" boolean);
end;
$$;

create or replace function public.start_quiz(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session_id uuid;
  v_team_order uuid[];
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('quiz:' || p_event_id::text, 0));
  if exists (
    select 1 from public.quiz_sessions session
    where session.event_id = p_event_id and session.started_at is not null
  ) then
    raise exception 'quiz_already_started' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));
  if not exists (select 1 from public.events event where event.id = p_event_id and event.quiz_enabled) then
    raise exception 'quiz_disabled' using errcode = 'P0001';
  end if;
  if (select count(*) from public.teams team where team.event_id = p_event_id) <> 5 then
    raise exception 'five_teams_required' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.quiz_questions question
    left join public.quiz_question_choices choice on choice.question_id = question.id
    where question.category_id in (select id from public.quiz_categories where event_id = p_event_id)
    group by question.id
    having count(choice.id) <> 4
       or count(*) filter (where btrim(choice.choice_text) = '') > 0
       or count(distinct lower(btrim(choice.choice_text))) <> 4
       or count(*) filter (where choice.is_correct) <> 1
  ) then
    raise exception 'quiz_choices_incomplete' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.teams tied
    where tied.event_id = p_event_id
    group by tied.points, tied.keys
    having count(*) > 1 and (
      count(tied.tie_break_priority) <> count(*)
      or count(distinct tied.tie_break_priority) <> count(*)
    )
  ) then
    raise exception 'tie_break_required' using errcode = 'P0001';
  end if;

  select array_agg(ranked.id order by ranked.points desc, ranked.keys desc,
    ranked.tie_break_priority asc nulls last, ranked.display_order asc)
  into v_team_order
  from public.teams ranked
  where ranked.event_id = p_event_id;

  update public.quiz_sessions
  set team_order = v_team_order,
      current_team_index = 0,
      active_category_id = null,
      active_question_index = 0,
      selected_choice_id = null,
      choice_locked = false,
      answer_visible = false,
      revealed_choice_id = null,
      revealed_answer = null,
      started_at = now()
  where event_id = p_event_id and started_at is null
  returning id into v_session_id;

  if not found then
    insert into public.quiz_sessions (
      event_id, team_order, current_team_index, active_category_id,
      active_question_index, selected_choice_id, choice_locked,
      answer_visible, revealed_choice_id, revealed_answer, started_at
    ) values (
      p_event_id, v_team_order, 0, null, 0, null, false,
      false, null, null, now()
    ) returning id into v_session_id;
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.assert_valid_quiz_choices(jsonb) from public, anon, authenticated;
revoke all on function public.get_admin_quiz_questions(uuid) from public, anon;
revoke all on function public.create_quiz_question(uuid, uuid, text, integer, integer, jsonb) from public, anon;
revoke all on function public.update_quiz_question(uuid, uuid, text, integer, jsonb) from public, anon;

grant execute on function public.get_admin_quiz_questions(uuid) to authenticated;
grant execute on function public.create_quiz_question(uuid, uuid, text, integer, integer, jsonb) to authenticated;
grant execute on function public.update_quiz_question(uuid, uuid, text, integer, jsonb) to authenticated;
