alter table public.quiz_categories
  add column chosen_by_team_id uuid references public.teams(id) on delete set null;

create unique index quiz_categories_one_choice_per_team_idx
  on public.quiz_categories (event_id, chosen_by_team_id)
  where chosen_by_team_id is not null;

alter table public.quiz_answers
  add column idempotency_key uuid;

update public.quiz_answers
set idempotency_key = extensions.gen_random_uuid()
where idempotency_key is null;

alter table public.quiz_answers
  alter column idempotency_key set not null,
  add constraint quiz_answers_idempotency_key_key unique (idempotency_key);

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

  if exists (select 1 from public.quiz_sessions session where session.event_id = p_event_id) then
    raise exception 'quiz_already_started' using errcode = 'P0001';
  end if;

  -- Freeze the ranking under the same event lock used by apply_score_event.
  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));

  if not exists (select 1 from public.events e where e.id = p_event_id and e.quiz_enabled) then
    raise exception 'quiz_disabled' using errcode = 'P0001';
  end if;

  if (select count(*) from public.teams t where t.event_id = p_event_id) <> 5 then
    raise exception 'five_teams_required' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.teams tied
    where tied.event_id = p_event_id
    group by tied.points, tied.keys
    having count(*) > 1
      and (
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

  insert into public.quiz_sessions (
    event_id, team_order, current_team_index, active_category_id,
    active_question_index, answer_visible, revealed_answer, started_at
  ) values (
    p_event_id, v_team_order, 0, null, 0, false, null, now()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.choose_quiz_category(
  p_session_id uuid,
  p_team_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_category public.quiz_categories%rowtype;
begin
  select * into v_session
  from public.quiz_sessions session
  where session.id = p_session_id
  for update;

  if not found or v_session.started_at is null then
    raise exception 'quiz_not_started' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.events e where e.id = v_session.event_id and e.quiz_enabled) then
    raise exception 'quiz_disabled' using errcode = 'P0001';
  end if;

  select * into v_category
  from public.quiz_categories category
  where category.id = p_category_id
    and category.event_id = v_session.event_id
  for update;

  if not found or v_category.status <> 'available' or v_category.chosen_by_team_id is not null then
    raise exception 'category_unavailable' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.quiz_categories category
    where category.event_id = v_session.event_id
      and category.chosen_by_team_id = p_team_id
  ) then
    raise exception 'team_already_chosen' using errcode = 'P0001';
  end if;
  if v_session.active_category_id is not null then
    raise exception 'category_in_progress' using errcode = 'P0001';
  end if;
  if v_session.current_team_index >= cardinality(v_session.team_order)
    or v_session.team_order[v_session.current_team_index + 1] is distinct from p_team_id then
    raise exception 'not_current_team' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quiz_questions question where question.category_id = p_category_id) then
    raise exception 'category_has_no_questions' using errcode = 'P0001';
  end if;

  update public.quiz_categories
  set chosen_by_team_id = p_team_id
  where id = p_category_id;

  update public.quiz_sessions
  set active_category_id = p_category_id,
      active_question_index = 0,
      answer_visible = false,
      revealed_answer = null
  where id = p_session_id;
end;
$$;

create or replace function public.reveal_quiz_answer(
  p_session_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_expected_question_id uuid;
  v_answer text;
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  select * into v_session
  from public.quiz_sessions session
  where session.id = p_session_id
  for update;
  if not found or v_session.active_category_id is null then
    raise exception 'no_active_question' using errcode = 'P0001';
  end if;

  select question.id into v_expected_question_id
  from public.quiz_questions question
  where question.category_id = v_session.active_category_id
  order by question.display_order
  offset v_session.active_question_index limit 1;
  if v_expected_question_id is distinct from p_question_id then
    raise exception 'not_active_question' using errcode = 'P0001';
  end if;

  select protected.answer into v_answer
  from public.quiz_question_answers protected
  where protected.question_id = p_question_id;
  if not found then
    raise exception 'answer_missing' using errcode = 'P0001';
  end if;

  update public.quiz_sessions
  set answer_visible = true,
      revealed_answer = v_answer
  where id = p_session_id;
end;
$$;

create or replace function public.answer_quiz_question(
  p_session_id uuid,
  p_question_id uuid,
  p_correct boolean,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_answer_id uuid;
  v_team_id uuid;
  v_question_points integer;
  v_expected_question_id uuid;
  v_score_event_id uuid;
  v_has_next_question boolean;
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('quiz-answer:' || p_idempotency_key::text, 0));
  select answer.id into v_answer_id
  from public.quiz_answers answer
  where answer.idempotency_key = p_idempotency_key;
  if found then
    return v_answer_id;
  end if;

  select * into v_session
  from public.quiz_sessions session
  where session.id = p_session_id
  for update;
  if not found or v_session.active_category_id is null then
    raise exception 'no_active_question' using errcode = 'P0001';
  end if;
  if not v_session.answer_visible then
    raise exception 'answer_not_revealed' using errcode = 'P0001';
  end if;

  v_team_id := v_session.team_order[v_session.current_team_index + 1];
  if v_team_id is null then
    raise exception 'quiz_complete' using errcode = 'P0001';
  end if;

  select question.id, question.points
  into v_expected_question_id, v_question_points
  from public.quiz_questions question
  where question.category_id = v_session.active_category_id
  order by question.display_order
  offset v_session.active_question_index limit 1;
  if v_expected_question_id is distinct from p_question_id then
    raise exception 'not_active_question' using errcode = 'P0001';
  end if;

  if p_correct then
    v_score_event_id := public.apply_score_event(
      v_session.event_id,
      v_team_id,
      v_question_points,
      0,
      'quiz',
      p_idempotency_key
    );
  end if;

  insert into public.quiz_answers (
    session_id, question_id, team_id, correct, score_event_id, idempotency_key
  ) values (
    p_session_id, p_question_id, v_team_id, p_correct, v_score_event_id, p_idempotency_key
  ) returning id into v_answer_id;

  select exists (
    select 1
    from public.quiz_questions question
    where question.category_id = v_session.active_category_id
    order by question.display_order
    offset (v_session.active_question_index + 1) limit 1
  ) into v_has_next_question;

  if v_has_next_question then
    update public.quiz_sessions
    set active_question_index = active_question_index + 1,
        answer_visible = false,
        revealed_answer = null
    where id = p_session_id;
  else
    update public.quiz_categories
    set status = 'played'
    where id = v_session.active_category_id;

    update public.quiz_sessions
    set current_team_index = current_team_index + 1,
        active_category_id = null,
        active_question_index = 0,
        answer_visible = false,
        revealed_answer = null
    where id = p_session_id;
  end if;

  return v_answer_id;
end;
$$;

revoke all on function public.start_quiz(uuid) from public;
revoke all on function public.choose_quiz_category(uuid, uuid, uuid) from public;
revoke all on function public.reveal_quiz_answer(uuid, uuid) from public;
revoke all on function public.answer_quiz_question(uuid, uuid, boolean, uuid) from public;
revoke execute on function public.start_quiz(uuid) from anon;
revoke execute on function public.reveal_quiz_answer(uuid, uuid) from anon;
revoke execute on function public.answer_quiz_question(uuid, uuid, boolean, uuid) from anon;

grant execute on function public.start_quiz(uuid) to authenticated;
grant execute on function public.choose_quiz_category(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.reveal_quiz_answer(uuid, uuid) to authenticated;
grant execute on function public.answer_quiz_question(uuid, uuid, boolean, uuid) to authenticated;
