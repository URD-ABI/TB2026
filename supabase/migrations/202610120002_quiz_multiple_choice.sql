create table public.quiz_question_choices (
  id uuid primary key default extensions.gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  choice_text text not null,
  display_order integer not null check (display_order between 0 and 3),
  is_correct boolean not null default false,
  unique (question_id, display_order)
);

create unique index quiz_question_one_correct_idx
on public.quiz_question_choices(question_id)
where is_correct;

insert into public.quiz_question_choices(question_id, choice_text, display_order, is_correct)
select question_id, answer, 0, true
from public.quiz_question_answers;

insert into public.quiz_question_choices(question_id, choice_text, display_order, is_correct)
select question_id, '', position, false
from public.quiz_question_answers
cross join generate_series(1, 3) as position;

alter table public.quiz_sessions
  add column selected_choice_id uuid references public.quiz_question_choices(id) on delete set null,
  add column choice_locked boolean not null default false,
  add column revealed_choice_id uuid references public.quiz_question_choices(id) on delete set null;

alter table public.quiz_answers
  add column selected_choice_id uuid references public.quiz_question_choices(id) on delete restrict;

alter table public.quiz_question_choices enable row level security;

grant select, insert, update, delete on public.quiz_question_choices to authenticated;

create policy admin_manage_quiz_question_choices
on public.quiz_question_choices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_public_quiz_choices(p_event_id uuid)
returns table (
  id uuid,
  question_id uuid,
  choice_text text,
  display_order integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select choice.id, choice.question_id, choice.choice_text, choice.display_order
  from public.quiz_question_choices choice
  join public.quiz_questions question on question.id = choice.question_id
  join public.quiz_categories category on category.id = question.category_id
  where category.event_id = p_event_id
  order by question.display_order, choice.display_order;
$$;

revoke all on function public.get_public_quiz_choices(uuid) from public;
grant execute on function public.get_public_quiz_choices(uuid) to anon, authenticated;
