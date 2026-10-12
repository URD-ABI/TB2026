create or replace function public.select_quiz_choice(
  p_session_id uuid,
  p_question_id uuid,
  p_choice_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_expected_question_id uuid;
begin
  select * into v_session
  from public.quiz_sessions session
  where session.id = p_session_id
  for update;

  if not found or v_session.started_at is null or v_session.active_category_id is null then
    raise exception 'no_active_question' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.events event where event.id = v_session.event_id and event.quiz_enabled) then
    raise exception 'quiz_disabled' using errcode = 'P0001';
  end if;
  if v_session.choice_locked or v_session.answer_visible then
    raise exception 'choice_locked' using errcode = 'P0001';
  end if;

  select question.id into v_expected_question_id
  from public.quiz_questions question
  where question.category_id = v_session.active_category_id
  order by question.display_order
  offset v_session.active_question_index limit 1;

  if v_expected_question_id is distinct from p_question_id then
    raise exception 'not_active_question' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.quiz_question_choices choice
    where choice.id = p_choice_id and choice.question_id = p_question_id
  ) then
    raise exception 'choice_not_found' using errcode = 'P0001';
  end if;

  update public.quiz_sessions
  set selected_choice_id = p_choice_id
  where id = p_session_id;
end;
$$;

create or replace function public.lock_quiz_choice(
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
  if v_session.selected_choice_id is null then
    raise exception 'choice_required' using errcode = 'P0001';
  end if;

  update public.quiz_sessions set choice_locked = true where id = p_session_id;
end;
$$;

create or replace function public.reveal_and_score_quiz_answer(
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
  v_question_points integer;
  v_correct_choice_id uuid;
  v_team_id uuid;
  v_answer_id uuid;
  v_score_event_id uuid;
  v_correct boolean;
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

  select question.id, question.points
  into v_expected_question_id, v_question_points
  from public.quiz_questions question
  where question.category_id = v_session.active_category_id
  order by question.display_order
  offset v_session.active_question_index limit 1;
  if v_expected_question_id is distinct from p_question_id then
    raise exception 'not_active_question' using errcode = 'P0001';
  end if;
  if v_session.answer_visible then
    return;
  end if;
  if not v_session.choice_locked or v_session.selected_choice_id is null then
    raise exception 'choice_not_locked' using errcode = 'P0001';
  end if;

  select choice.id into v_correct_choice_id
  from public.quiz_question_choices choice
  where choice.question_id = p_question_id and choice.is_correct;
  if not found then
    raise exception 'correct_choice_missing' using errcode = 'P0001';
  end if;

  v_team_id := v_session.team_order[v_session.current_team_index + 1];
  if v_team_id is null then
    raise exception 'quiz_complete' using errcode = 'P0001';
  end if;
  v_correct := v_session.selected_choice_id = v_correct_choice_id;
  v_answer_id := extensions.gen_random_uuid();

  if v_correct then
    v_score_event_id := public.apply_score_event(
      v_session.event_id,
      v_team_id,
      v_question_points,
      0,
      'quiz',
      v_answer_id
    );
  end if;

  insert into public.quiz_answers (
    id, session_id, question_id, team_id, correct, score_event_id,
    idempotency_key, selected_choice_id
  ) values (
    v_answer_id, p_session_id, p_question_id, v_team_id, v_correct,
    v_score_event_id, v_answer_id, v_session.selected_choice_id
  );

  update public.quiz_sessions
  set answer_visible = true,
      revealed_choice_id = v_correct_choice_id,
      revealed_answer = null
  where id = p_session_id;
end;
$$;

create or replace function public.advance_quiz_question(
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
  v_has_next_question boolean;
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
  if not v_session.answer_visible then
    raise exception 'answer_not_revealed' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.quiz_questions question
    where question.category_id = v_session.active_category_id
    order by question.display_order
    offset (v_session.active_question_index + 1) limit 1
  ) into v_has_next_question;

  if v_has_next_question then
    update public.quiz_sessions
    set active_question_index = active_question_index + 1,
        selected_choice_id = null,
        choice_locked = false,
        answer_visible = false,
        revealed_choice_id = null,
        revealed_answer = null
    where id = p_session_id;
  else
    update public.quiz_categories set status = 'played'
    where id = v_session.active_category_id;

    update public.quiz_sessions
    set current_team_index = current_team_index + 1,
        active_category_id = null,
        active_question_index = 0,
        selected_choice_id = null,
        choice_locked = false,
        answer_visible = false,
        revealed_choice_id = null,
        revealed_answer = null
    where id = p_session_id;
  end if;
end;
$$;

revoke all on function public.select_quiz_choice(uuid, uuid, uuid) from public;
revoke all on function public.lock_quiz_choice(uuid, uuid) from public, anon;
revoke all on function public.reveal_and_score_quiz_answer(uuid, uuid) from public, anon;
revoke all on function public.advance_quiz_question(uuid, uuid) from public, anon;

grant execute on function public.select_quiz_choice(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.lock_quiz_choice(uuid, uuid) to authenticated;
grant execute on function public.reveal_and_score_quiz_answer(uuid, uuid) to authenticated;
grant execute on function public.advance_quiz_question(uuid, uuid) to authenticated;
