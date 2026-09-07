begin;

select plan(196);

-- Required relations.
select has_table('public', 'events', 'events table exists');
select has_table('public', 'admin_users', 'admin_users table exists');
select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'score_events', 'score_events table exists');
select has_table('public', 'participants', 'participants table exists');
select has_table('public', 'participant_assignments', 'participant_assignments table exists');
select has_table('public', 'challenges', 'challenges table exists');
select has_table('public', 'quiz_categories', 'quiz_categories table exists');
select has_table('public', 'quiz_questions', 'quiz_questions table exists');
select has_table('public', 'quiz_question_answers', 'quiz_question_answers table exists');
select has_table('public', 'quiz_sessions', 'quiz_sessions table exists');
select has_table('public', 'quiz_answers', 'quiz_answers table exists');

-- The columns below are the application contract; constraints are exercised later
-- with real inserts so a similarly-named but incompatible column cannot pass.
select has_column('public', 'events', 'id', 'events has an id');
select has_column('public', 'events', 'slug', 'events has a slug');
select has_column('public', 'events', 'title', 'events has a title');
select has_column('public', 'events', 'subtitle', 'events has a subtitle');
select has_column('public', 'events', 'quiz_enabled', 'events has quiz_enabled');
select has_column('public', 'events', 'created_at', 'events has created_at');
select has_column('public', 'teams', 'id', 'teams has an id');
select has_column('public', 'teams', 'event_id', 'teams belongs to an event');
select has_column('public', 'teams', 'name', 'teams has a name');
select has_column('public', 'teams', 'color', 'teams has a color');
select has_column('public', 'teams', 'display_order', 'teams has display order');
select has_column('public', 'teams', 'points', 'teams has points');
select has_column('public', 'teams', 'keys', 'teams has keys');
select has_column('public', 'teams', 'tie_break_priority', 'teams has tie-break priority');
select has_column('public', 'score_events', 'event_id', 'score events belongs to an event');
select has_column('public', 'score_events', 'team_id', 'score events belongs to a team');
select has_column('public', 'score_events', 'idempotency_key', 'score events has an idempotency key');
select has_column('public', 'score_events', 'reversed_at', 'score events can be reversed');
select has_column('public', 'score_events', 'created_by', 'score events records its author');
select has_column('public', 'participants', 'event_id', 'participants belongs to an event');
select has_column('public', 'participants', 'revealed_team_id', 'participants stores its revealed team');
select has_column('public', 'participants', 'reveal_order', 'participants has reveal order');
select has_column('public', 'participants', 'revealed_at', 'participants records reveal time');
select has_column('public', 'participant_assignments', 'participant_id', 'assignments identifies a participant');
select has_column('public', 'participant_assignments', 'team_id', 'assignments stores a hidden team');
select has_column('public', 'challenges', 'event_id', 'challenges belongs to an event');
select has_column('public', 'challenges', 'kind', 'challenges has a kind');
select has_column('public', 'challenges', 'display_order', 'challenges has display order');
select has_column('public', 'quiz_categories', 'event_id', 'categories belongs to an event');
select has_column('public', 'quiz_categories', 'display_order', 'categories has display order');
select has_column('public', 'quiz_categories', 'status', 'categories has a status');
select has_column('public', 'quiz_categories', 'chosen_by_team_id', 'categories record the team that chose them');
select has_column('public', 'quiz_questions', 'category_id', 'questions belongs to a category');
select has_column('public', 'quiz_questions', 'points', 'questions has positive points');
select has_column('public', 'quiz_question_answers', 'question_id', 'answers identifies a question');
select has_column('public', 'quiz_question_answers', 'answer', 'answers stores hidden answer text');
select has_column('public', 'quiz_sessions', 'event_id', 'sessions belongs to an event');
select has_column('public', 'quiz_sessions', 'team_order', 'sessions stores team UUID order');
select has_column('public', 'quiz_sessions', 'current_team_index', 'sessions stores the active team index');
select has_column('public', 'quiz_sessions', 'active_category_id', 'sessions stores active category');
select has_column('public', 'quiz_sessions', 'answer_visible', 'sessions records answer visibility');
select has_column('public', 'quiz_sessions', 'revealed_answer', 'sessions stores an optionally revealed answer');
select has_column('public', 'quiz_answers', 'session_id', 'quiz answers belongs to a session');
select has_column('public', 'quiz_answers', 'question_id', 'quiz answers belongs to a question');
select has_column('public', 'quiz_answers', 'team_id', 'quiz answers belongs to a team');
select has_column('public', 'quiz_answers', 'correct', 'quiz answers has correctness');
select has_column('public', 'quiz_answers', 'score_event_id', 'quiz answers may link its score event');

select col_type_is('public', 'events', 'id', 'uuid', 'events.id is UUID');
select col_type_is('public', 'teams', 'color', 'text', 'teams.color is text');
select col_type_is('public', 'quiz_sessions', 'team_order', 'uuid[]', 'quiz_sessions.team_order is UUID array');
select col_not_null('public', 'events', 'slug', 'event slug is required');
select col_not_null('public', 'events', 'title', 'event title is required');
select col_not_null('public', 'teams', 'event_id', 'team event is required');
select col_not_null('public', 'score_events', 'idempotency_key', 'score idempotency key is required');
select col_not_null('public', 'participants', 'reveal_order', 'participant reveal order is required');
select col_not_null('public', 'quiz_questions', 'points', 'question points is required');
select col_default_is('public', 'events', 'quiz_enabled', 'false', 'quiz is disabled by default');
select col_default_is('public', 'quiz_sessions', 'answer_visible', 'false', 'answers are hidden by default');

-- RPC surface and definer hardening.
select has_function('public', 'is_admin', array[]::text[], 'is_admin RPC exists');
select has_function('public', 'apply_score_event', array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid']::text[], 'apply_score_event has the required signature');
select has_function('public', 'reveal_next_participant', array['uuid', 'uuid']::text[], 'reveal_next_participant has the required signature');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apply_score_event' and oidvectortypes(p.proargtypes) = 'uuid, uuid, integer, integer, text, uuid'), array['p_event_id', 'p_team_id', 'p_points', 'p_keys', 'p_source', 'p_idempotency_key']::text[], 'apply_score_event exposes the expected parameter names');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_admin' and oidvectortypes(p.proargtypes) = ''), true, 'is_admin is security definer');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apply_score_event' and oidvectortypes(p.proargtypes) = 'uuid, uuid, integer, integer, text, uuid'), true, 'apply_score_event is security definer');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reveal_next_participant' and oidvectortypes(p.proargtypes) = 'uuid, uuid'), true, 'reveal_next_participant is security definer');

-- Every application table must have RLS, including hidden implementation data.
select is((select relrowsecurity from pg_class where oid = 'public.events'::regclass), true, 'events has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.admin_users'::regclass), true, 'admin_users has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.teams'::regclass), true, 'teams has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.score_events'::regclass), true, 'score_events has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.participants'::regclass), true, 'participants has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.participant_assignments'::regclass), true, 'participant_assignments has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.challenges'::regclass), true, 'challenges has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_categories'::regclass), true, 'quiz_categories has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_questions'::regclass), true, 'quiz_questions has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_question_answers'::regclass), true, 'quiz question answers has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_sessions'::regclass), true, 'quiz sessions has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_answers'::regclass), true, 'quiz answers has RLS');

-- Projector-facing state must be emitted through the standard Supabase Realtime publication.
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'), 'events is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'), 'teams is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'), 'participants is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'challenges'), 'challenges is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_categories'), 'quiz categories is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_questions'), 'quiz questions is in supabase_realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_sessions'), 'quiz sessions is in supabase_realtime');

-- Public content has an explicit SELECT policy for both client roles.
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'events public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'teams public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'participants' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'participants public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'challenges' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'challenges public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_categories' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'quiz categories public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_questions' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'quiz questions public read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_sessions' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name]), 'quiz sessions public read policy exists');

-- A client role must never receive secret assignments, answers, or score history.
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('participant_assignments', 'quiz_question_answers', 'quiz_answers', 'score_events', 'admin_users') and cmd in ('SELECT', 'ALL') and roles @> array['anon'::name]), 0::bigint, 'hidden tables have no anon read policy');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('participant_assignments', 'quiz_question_answers', 'quiz_answers', 'score_events', 'admin_users') and cmd = 'SELECT' and roles @> array['authenticated'::name] and coalesce(qual, '') not like '%is_admin()%'), 0::bigint, 'hidden tables have no non-admin authenticated read policy');
select is((select count(distinct tablename) from pg_policies where schemaname = 'public' and cmd = 'ALL' and roles @> array['authenticated'::name] and coalesce(qual, '') like '%is_admin()%'), 12::bigint, 'admins have ALL policies on every application table');

select is((select public from storage.buckets where id = 'event-media'), true, 'event-media bucket is public for reads');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and roles @> array['anon'::name, 'authenticated'::name] and coalesce(qual, '') like '%event-media%'), 'event-media storage read policy is public');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and roles @> array['authenticated'::name] and coalesce(with_check, qual, '') like '%is_admin()%'), 'event-media storage writes require admin');

-- Deterministic fixture data; no seed data or real user identity is required.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'security-admin@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'security-member@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.events (id, slug, title) values ('11111111-1111-1111-1111-111111111111', 'security-test', 'Security test event');
select is((select subtitle from public.events where id = '11111111-1111-1111-1111-111111111111'), 'Team Building 2026', 'event subtitle has product default');
insert into public.teams (id, event_id, name, color, emblem, display_order, tie_break_priority) values
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'North', '#113355', 'north', 0, 9),
  ('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'South', '#aa3300', 'south', 1, 8);
insert into public.challenges (id, event_id, title, kind, description, display_order) values ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sample challenge', 'physical', 'A challenge', 0);
insert into public.quiz_categories (id, event_id, title, display_order, status) values ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sample category', 0, 'available');
insert into public.quiz_questions (id, category_id, prompt, points, display_order) values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Question?', 10, 0);
insert into public.quiz_question_answers (question_id, answer) values ('60000000-0000-0000-0000-000000000001', 'Answer');
insert into public.quiz_sessions (id, event_id, team_order) values ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', array['20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid]);

select throws_ok($$insert into public.teams (id, event_id, name, color, display_order) values ('20000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Bad color', 'blue', 2)$$, '23514', null, 'team color rejects non-hex values');
select throws_ok($$insert into public.teams (id, event_id, name, color, display_order) values ('20000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Sixth team', '#334455', 5)$$, '23514', null, 'team display order is limited to 0 through 4');
select throws_ok($$insert into public.teams (id, event_id, name, color, display_order) values ('20000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Duplicate slot', '#334455', 0)$$, '23505', null, 'team display order is unique per event');
select throws_ok($$insert into public.teams (id, event_id, name, color, display_order, keys) values ('20000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Negative keys', '#334455', 2, -1)$$, '23514', null, 'team keys cannot be negative');
select throws_ok($$insert into public.quiz_categories (id, event_id, title, display_order, status) values ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Bad category', 6, 'available')$$, '23514', null, 'category display order is limited to 0 through 5');
select throws_ok($$insert into public.quiz_categories (id, event_id, title, display_order, status) values ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Bad status', 1, 'waiting')$$, '23514', null, 'category status is constrained to available or played');
select throws_ok($$insert into public.quiz_questions (id, category_id, prompt, points, display_order) values ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'No points', 0, 1)$$, '23514', null, 'quiz questions require positive points');
select throws_ok($$insert into public.quiz_sessions (id, event_id, team_order) values ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', array[]::uuid[])$$, '23505', null, 'there is one quiz session per event');
select throws_ok($$insert into public.participant_assignments (participant_id, team_id) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'), ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$, '23505', null, 'participant assignment has one hidden team');
select throws_ok($$insert into public.quiz_answers (id, session_id, question_id, team_id, correct, idempotency_key) values ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true, '81000000-0000-0000-0000-000000000001'), ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', false, '81000000-0000-0000-0000-000000000002')$$, '23505', null, 'a question has one answer per session');

-- RLS behavior as a real anonymous browser client.
insert into public.participants (id, event_id, name, reveal_order) values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'First', 1),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Second', 2);
insert into public.participant_assignments (participant_id, team_id) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

set local role anon;
select is((select count(*) from public.events where id = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'anon can read public events');
select is((select count(*) from public.participant_assignments), 0::bigint, 'anon cannot read hidden assignments');
select is((select count(*) from public.quiz_question_answers), 0::bigint, 'anon cannot read hidden answers');
select is((select count(*) from public.score_events), 0::bigint, 'anon cannot read score history');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select lives_ok($$update public.teams set points = 99 where id = '20000000-0000-0000-0000-000000000001'$$, 'non-admin update is filtered by RLS');
reset role;
select is((select points from public.teams where id = '20000000-0000-0000-0000-000000000001'), 0, 'non-admin cannot mutate a team');

insert into public.admin_users (user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$update public.teams set points = 1 where id = '20000000-0000-0000-0000-000000000001'$$, 'admin can update a team');
reset role;
select is((select points from public.teams where id = '20000000-0000-0000-0000-000000000001'), 1, 'admin mutation is persisted');

-- Score application must be atomic, idempotent, and administrator-only.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.apply_score_event('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 10, 2, 'test', 'dddddddd-dddd-dddd-dddd-dddddddddddd')$$, 'admin can apply a score event');
reset role;
select is((select points from public.teams where id = '20000000-0000-0000-0000-000000000001'), 11, 'score event adds points once');
select is((select keys from public.teams where id = '20000000-0000-0000-0000-000000000001'), 2, 'score event adds keys once');
select is((select tie_break_priority is null from public.teams where id = '20000000-0000-0000-0000-000000000001'), true, 'score application clears tie-break priority');
select is((select tie_break_priority is null from public.teams where id = '20000000-0000-0000-0000-000000000002'), true, 'score application clears every team tie-break priority for the event');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.apply_score_event('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 10, 2, 'test', 'dddddddd-dddd-dddd-dddd-dddddddddddd')$$, 'score retry succeeds');
select is((select public.apply_score_event('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 999, 999, 'retry-check', 'dddddddd-dddd-dddd-dddd-dddddddddddd') = (select id from public.score_events where idempotency_key = 'dddddddd-dddd-dddd-dddd-dddddddddddd')), true, 'score retry returns the original event id');
reset role;
select is((select count(*) from public.score_events where idempotency_key = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 1::bigint, 'score retry creates no duplicate history');
select is((select points from public.teams where id = '20000000-0000-0000-0000-000000000001'), 11, 'score retry does not double-add points');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok($$select public.apply_score_event('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000099', 7, 1, 'invalid', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')$$, 'P0001', 'team_not_found', 'invalid score target raises team_not_found');
reset role;
select is((select count(*) from public.score_events where idempotency_key = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), 0::bigint, 'invalid score target does not consume idempotency key');

-- Reveal is deliberately public-executable but only reveals the next public row,
-- never the hidden assignment relation.
set local role anon;
select throws_ok($$select public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002')$$, 'P0001', 'not_next_participant', 'a participant that is not first in the reveal order is rejected');
select is((select participant_id from public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001')), '30000000-0000-0000-0000-000000000001'::uuid, 'anon can reveal the displayed next participant');
select is((select revealed_team_id from public.participants where id = '30000000-0000-0000-0000-000000000001'), '20000000-0000-0000-0000-000000000001'::uuid, 'reveal returns the assigned team on the participant');
select is((select revealed_at is not null from public.participants where id = '30000000-0000-0000-0000-000000000001'), true, 'first participant is marked revealed');
select is((select count(*) from public.participant_assignments), 0::bigint, 'reveal RPC does not expose assignments to anon');
select is((select participant_id from public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001')), '30000000-0000-0000-0000-000000000001'::uuid, 'retry returns the same participant result');
select is((select revealed_at is null from public.participants where id = '30000000-0000-0000-0000-000000000002'), true, 'reveal retry does not advance to the next participant');
select is((select participant_id from public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002')), '30000000-0000-0000-0000-000000000002'::uuid, 'explicit second participant reveal succeeds');
select throws_ok($$select public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000099')$$, 'P0001', 'no_participant', 'unknown participant raises no_participant');
reset role;
insert into public.participants (id, event_id, name, reveal_order) values ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Unassigned', 3);
set local role anon;
select throws_ok($$select public.reveal_next_participant('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000003')$$, 'P0001', 'assignment_missing', 'participant without hidden assignment raises assignment_missing');
reset role;

-- Quiz RPC surface, access boundaries, frozen order, and atomic progression.
select has_function('public', 'start_quiz', array['uuid']::text[], 'start_quiz has the required signature');
select has_function('public', 'choose_quiz_category', array['uuid', 'uuid', 'uuid']::text[], 'choose_quiz_category has the required signature');
select has_function('public', 'reveal_quiz_answer', array['uuid', 'uuid']::text[], 'reveal_quiz_answer has the required signature');
select has_function('public', 'answer_quiz_question', array['uuid', 'uuid', 'boolean', 'uuid']::text[], 'answer_quiz_question has the required signature');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_quiz' and oidvectortypes(p.proargtypes) = 'uuid'), array['p_event_id']::text[], 'start_quiz exposes named identifiers');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'choose_quiz_category' and oidvectortypes(p.proargtypes) = 'uuid, uuid, uuid'), array['p_session_id', 'p_team_id', 'p_category_id']::text[], 'choose_quiz_category exposes named identifiers');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reveal_quiz_answer' and oidvectortypes(p.proargtypes) = 'uuid, uuid'), array['p_session_id', 'p_question_id']::text[], 'reveal_quiz_answer exposes named identifiers');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'answer_quiz_question' and oidvectortypes(p.proargtypes) = 'uuid, uuid, boolean, uuid'), array['p_session_id', 'p_question_id', 'p_correct', 'p_idempotency_key']::text[], 'answer_quiz_question exposes named identifiers');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_quiz' and oidvectortypes(p.proargtypes) = 'uuid'), true, 'start_quiz is security definer');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'choose_quiz_category' and oidvectortypes(p.proargtypes) = 'uuid, uuid, uuid'), true, 'choose_quiz_category is security definer');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reveal_quiz_answer' and oidvectortypes(p.proargtypes) = 'uuid, uuid'), true, 'reveal_quiz_answer is security definer');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'answer_quiz_question' and oidvectortypes(p.proargtypes) = 'uuid, uuid, boolean, uuid'), true, 'answer_quiz_question is security definer');
select ok(coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'choose_quiz_category' and oidvectortypes(p.proargtypes) = 'uuid, uuid, uuid'), false), 'anon may execute only the public category choice mutation');
select is(coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_quiz' and oidvectortypes(p.proargtypes) = 'uuid'), false), false, 'anon cannot start the quiz');
select is(coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reveal_quiz_answer' and oidvectortypes(p.proargtypes) = 'uuid, uuid'), false), false, 'anon cannot reveal quiz answers');
select is(coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'answer_quiz_question' and oidvectortypes(p.proargtypes) = 'uuid, uuid, boolean, uuid'), false), false, 'anon cannot validate quiz answers');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'quiz_categories' and indexdef like '%chosen_by_team_id%' and indexdef like '%UNIQUE%'), 'one team can choose at most one category per event');

insert into public.events (id, slug, title, quiz_enabled) values
  ('91111111-1111-1111-1111-111111111111', 'quiz-contract', 'Quiz contract', true),
  ('92222222-2222-2222-2222-222222222222', 'quiz-unresolved', 'Quiz unresolved', true);
insert into public.teams (id, event_id, name, color, display_order, points, keys, tie_break_priority) values
  ('92000000-0000-0000-0000-000000000001', '91111111-1111-1111-1111-111111111111', 'First', '#111111', 0, 100, 0, null),
  ('92000000-0000-0000-0000-000000000002', '91111111-1111-1111-1111-111111111111', 'Second', '#222222', 1, 80, 2, 1),
  ('92000000-0000-0000-0000-000000000003', '91111111-1111-1111-1111-111111111111', 'Third', '#333333', 2, 80, 2, 2),
  ('92000000-0000-0000-0000-000000000004', '91111111-1111-1111-1111-111111111111', 'Fourth', '#444444', 3, 40, 5, null),
  ('92000000-0000-0000-0000-000000000005', '91111111-1111-1111-1111-111111111111', 'Fifth', '#555555', 4, 20, 9, null),
  ('93000000-0000-0000-0000-000000000001', '92222222-2222-2222-2222-222222222222', 'Tied A', '#661111', 0, 50, 3, null),
  ('93000000-0000-0000-0000-000000000002', '92222222-2222-2222-2222-222222222222', 'Tied B', '#662222', 1, 50, 3, null),
  ('93000000-0000-0000-0000-000000000003', '92222222-2222-2222-2222-222222222222', 'Third', '#663333', 2, 30, 1, null),
  ('93000000-0000-0000-0000-000000000004', '92222222-2222-2222-2222-222222222222', 'Fourth', '#664444', 3, 20, 1, null),
  ('93000000-0000-0000-0000-000000000005', '92222222-2222-2222-2222-222222222222', 'Fifth', '#665555', 4, 10, 1, null);
insert into public.quiz_categories (id, event_id, title, display_order) values
  ('94000000-0000-0000-0000-000000000001', '91111111-1111-1111-1111-111111111111', 'Category 1', 0),
  ('94000000-0000-0000-0000-000000000002', '91111111-1111-1111-1111-111111111111', 'Category 2', 1),
  ('94000000-0000-0000-0000-000000000003', '91111111-1111-1111-1111-111111111111', 'Category 3', 2),
  ('94000000-0000-0000-0000-000000000004', '91111111-1111-1111-1111-111111111111', 'Category 4', 3),
  ('94000000-0000-0000-0000-000000000005', '91111111-1111-1111-1111-111111111111', 'Category 5', 4),
  ('94000000-0000-0000-0000-000000000006', '91111111-1111-1111-1111-111111111111', 'Category 6', 5);
insert into public.quiz_questions (id, category_id, prompt, points, display_order) values
  ('95000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'First question?', 17, 0),
  ('95000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000001', 'Second question?', 25, 1);
insert into public.quiz_question_answers (question_id, answer) values
  ('95000000-0000-0000-0000-000000000001', 'First protected answer'),
  ('95000000-0000-0000-0000-000000000002', 'Second protected answer');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.start_quiz('91111111-1111-1111-1111-111111111111')$$, 'admin starts the quiz');
reset role;
select is((select team_order from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), array[
  '92000000-0000-0000-0000-000000000001'::uuid,
  '92000000-0000-0000-0000-000000000002'::uuid,
  '92000000-0000-0000-0000-000000000003'::uuid,
  '92000000-0000-0000-0000-000000000004'::uuid,
  '92000000-0000-0000-0000-000000000005'::uuid
], 'start_quiz freezes points, keys, then manual tie-break order');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok($$select public.start_quiz('92222222-2222-2222-2222-222222222222')$$, 'P0001', 'tie_break_required', 'start_quiz rejects an unresolved tie');
reset role;

update public.events set quiz_enabled = false where id = '91111111-1111-1111-1111-111111111111';
set local role anon;
select throws_ok($$select public.choose_quiz_category((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '92000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001')$$, 'P0001', 'quiz_disabled', 'public choice is rejected while the quiz is disabled');
reset role;
update public.events set quiz_enabled = true where id = '91111111-1111-1111-1111-111111111111';
set local role anon;
select throws_ok($$select public.choose_quiz_category((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '92000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000001')$$, 'P0001', 'not_current_team', 'a team outside the frozen turn cannot choose');
select lives_ok($$select public.choose_quiz_category((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '92000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001')$$, 'current team may choose an available category from the public screen');
reset role;
select is((select chosen_by_team_id from public.quiz_categories where id = '94000000-0000-0000-0000-000000000001'), '92000000-0000-0000-0000-000000000001'::uuid, 'category records the choosing team');
select is((select status from public.quiz_categories where id = '94000000-0000-0000-0000-000000000001'), 'available', 'active category is not marked played before its final question');
set local role anon;
select throws_ok($$select public.choose_quiz_category((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '92000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000002')$$, 'P0001', 'team_already_chosen', 'one team cannot choose a second category');
select throws_ok($$select public.choose_quiz_category((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '92000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000001')$$, 'P0001', 'category_unavailable', 'one category cannot be chosen twice');
select throws_ok($$select public.reveal_quiz_answer((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot reveal an answer');
select throws_ok($$select public.answer_quiz_question((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000001', true, '96000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot validate an answer');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$select public.start_quiz('91111111-1111-1111-1111-111111111111')$$, 'P0001', 'admin_required', 'a non-admin member cannot start the quiz');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.reveal_quiz_answer((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000001')$$, 'admin reveals the active answer');
reset role;
select is((select answer_visible from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), true, 'answer visibility is public session state');
select is((select revealed_answer from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), 'First protected answer', 'reveal copies the protected answer into public state');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.answer_quiz_question((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000001', true, '96000000-0000-0000-0000-000000000001')$$, 'admin validates the first answer');
reset role;
select is((select points from public.teams where id = '92000000-0000-0000-0000-000000000001'), 117, 'a correct answer adds the fixed question value');
select is((select count(*) from public.score_events where idempotency_key = '96000000-0000-0000-0000-000000000001'), 1::bigint, 'quiz scoring creates one score event');
select is((select active_question_index from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), 1, 'answer advances to the next question atomically');
select is((select answer_visible from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), false, 'answer validation hides the old answer');
select is((select revealed_answer is null from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), true, 'answer validation clears the copied answer');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.answer_quiz_question((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000001', true, '96000000-0000-0000-0000-000000000001')$$, 'retrying the same answer is idempotent');
reset role;
select is((select points from public.teams where id = '92000000-0000-0000-0000-000000000001'), 117, 'answer retry never scores twice');
select is((select count(*) from public.quiz_answers where question_id = '95000000-0000-0000-0000-000000000001'), 1::bigint, 'answer retry creates no duplicate validation');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.reveal_quiz_answer((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000002')$$, 'admin reveals the second active answer');
select lives_ok($$select public.answer_quiz_question((select id from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), '95000000-0000-0000-0000-000000000002', false, '96000000-0000-0000-0000-000000000002')$$, 'admin validates an incorrect answer without scoring');
reset role;
select is((select current_team_index from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), 1, 'last category question advances to the next frozen team');
select is((select active_category_id is null from public.quiz_sessions where event_id = '91111111-1111-1111-1111-111111111111'), true, 'last category question returns the public screen to category choice');
select is((select status from public.quiz_categories where id = '94000000-0000-0000-0000-000000000001'), 'played', 'completed category remains played');

select * from finish();
rollback;
