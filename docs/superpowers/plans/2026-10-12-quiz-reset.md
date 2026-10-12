# Dedicated Quiz Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe administrator action that resets only quiz progress, removes quiz-awarded points, preserves all other event data, and disables public quiz access.

**Architecture:** A new authenticated Supabase RPC owns the transaction and serializes against quiz and score mutations. The repository exposes one `resetQuiz(eventId)` operation to both Supabase and in-memory implementations, while `QuizControlPanel` owns the confirmation dialog and delegates the action through `AdminWorkspace`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Supabase/PostgreSQL, pgTAP, Vite.

---

## File map

- Create `supabase/migrations/202610120001_reset_quiz.sql`: atomic, administrator-only quiz reset RPC.
- Modify `supabase/tests/security.sql`: RPC contract, authorization, data-retention, and score rollback coverage.
- Modify `src/repositories/EventRepository.ts`: public `resetQuiz` repository contract.
- Modify `src/repositories/SupabaseEventRepository.ts`: Supabase RPC adapter.
- Modify `src/repositories/SupabaseEventRepository.test.ts`: adapter call coverage.
- Modify `src/repositories/MemoryEventRepository.ts`: local equivalent and quiz-score ledger.
- Modify `src/repositories/MemoryEventRepository.test.ts`: local reset behavior coverage.
- Modify `src/app/AppProviders.test.tsx`: keep the typed repository test double complete.
- Modify `src/features/admin/QuizControlPanel.tsx`: danger button, accessible confirmation, pending/success/error states.
- Modify `src/features/admin/QuizControlPanel.test.tsx`: interaction and accessibility coverage.
- Modify `src/features/admin/AdminApp.tsx`: connect the control to the repository.
- Modify `src/features/admin/AdminWorkspace.test.tsx`: integration coverage for the admin route.

### Task 1: Add the atomic Supabase reset contract

**Files:**
- Create: `supabase/migrations/202610120001_reset_quiz.sql`
- Modify: `supabase/tests/security.sql`

- [ ] **Step 1: Add failing pgTAP coverage**

Increase the plan from `325` to `343`. In the quiz RPC contract section, add the function metadata checks:

```sql
select has_function('public', 'reset_quiz', array['uuid']::text[], 'reset_quiz has the required signature');
select is(
  (select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reset_quiz' and oidvectortypes(p.proargtypes) = 'uuid'),
  array['p_event_id']::text[],
  'reset_quiz exposes the expected parameter name'
);
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reset_quiz' and oidvectortypes(p.proargtypes) = 'uuid'),
  true,
  'reset_quiz is security definer'
);
select is(
  coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'reset_quiz' and oidvectortypes(p.proargtypes) = 'uuid'), false),
  false,
  'anon cannot execute reset_quiz'
);
```

Add a dedicated event fixture after the existing quiz-flow assertions. It must contain two teams, one category with two questions and protected answers, a started session, two quiz answers, two active `quiz` score events, one reversed `quiz` score event, and one `challenge` score event. Set the team rows to the totals represented by those histories:

```sql
insert into public.events (id, slug, title, quiz_enabled)
values ('a8000000-0000-0000-0000-000000000001', 'quiz-reset-test', 'Quiz reset test', true);
insert into public.teams (id, event_id, name, color, display_order, points, keys, tie_break_priority) values
  ('a8100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Reset A', '#112233', 0, 92, 4, 2),
  ('a8100000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'Reset B', '#445566', 1, 50, 7, 1);
insert into public.quiz_categories (id, event_id, title, display_order, status, chosen_by_team_id)
values ('a8200000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Reset category', 0, 'played', 'a8100000-0000-0000-0000-000000000001');
insert into public.quiz_questions (id, category_id, prompt, points, display_order) values
  ('a8300000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000001', 'Reset question 1?', 17, 0),
  ('a8300000-0000-0000-0000-000000000002', 'a8200000-0000-0000-0000-000000000001', 'Reset question 2?', 20, 1);
insert into public.quiz_question_answers (question_id, answer) values
  ('a8300000-0000-0000-0000-000000000001', 'Protected 1'),
  ('a8300000-0000-0000-0000-000000000002', 'Protected 2');
insert into public.quiz_sessions (id, event_id, team_order, current_team_index, started_at)
values ('a8400000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001',
  array['a8100000-0000-0000-0000-000000000001'::uuid, 'a8100000-0000-0000-0000-000000000002'::uuid], 1, now());
insert into public.score_events (id, event_id, team_id, points_delta, keys_delta, source, idempotency_key, reversed_at) values
  ('a8500000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 17, 0, 'quiz', 'a8600000-0000-0000-0000-000000000001', null),
  ('a8500000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000002', 20, 0, 'quiz', 'a8600000-0000-0000-0000-000000000002', null),
  ('a8500000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 11, 0, 'quiz', 'a8600000-0000-0000-0000-000000000003', now()),
  ('a8500000-0000-0000-0000-000000000004', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 5, 0, 'challenge', 'a8600000-0000-0000-0000-000000000004', null);
insert into public.quiz_answers (id, session_id, question_id, team_id, correct, score_event_id, idempotency_key) values
  ('a8700000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', true, 'a8500000-0000-0000-0000-000000000001', 'a8800000-0000-0000-0000-000000000001'),
  ('a8700000-0000-0000-0000-000000000002', 'a8400000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000002', 'a8100000-0000-0000-0000-000000000002', true, 'a8500000-0000-0000-0000-000000000002', 'a8800000-0000-0000-0000-000000000002');
```

Then add the authorization and postconditions:

```sql
set local role anon;
select throws_ok($$select public.reset_quiz('a8000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot reset the quiz');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok($$select public.reset_quiz('a8000000-0000-0000-0000-000000000001')$$, 'admin resets only quiz state');
reset role;

select is((select points from public.teams where id = 'a8100000-0000-0000-0000-000000000001'), 75, 'reset subtracts active quiz points from first team');
select is((select points from public.teams where id = 'a8100000-0000-0000-0000-000000000002'), 30, 'reset subtracts active quiz points from second team');
select ok((select keys = 4 and tie_break_priority = 2 from public.teams where id = 'a8100000-0000-0000-0000-000000000001'), 'reset preserves keys and tie-break priority');
select is((select count(*) from public.score_events where event_id = 'a8000000-0000-0000-0000-000000000001' and source = 'quiz'), 0::bigint, 'reset deletes active and reversed quiz score history');
select is((select count(*) from public.score_events where event_id = 'a8000000-0000-0000-0000-000000000001' and source = 'challenge'), 1::bigint, 'reset preserves non-quiz score history');
select is((select count(*) from public.quiz_sessions where event_id = 'a8000000-0000-0000-0000-000000000001'), 0::bigint, 'reset removes the quiz session');
select is((select count(*) from public.quiz_answers where session_id = 'a8400000-0000-0000-0000-000000000001'), 0::bigint, 'reset removes quiz answers');
select ok((select status = 'available' and chosen_by_team_id is null from public.quiz_categories where id = 'a8200000-0000-0000-0000-000000000001'), 'reset makes categories available again');
select is((select quiz_enabled from public.events where id = 'a8000000-0000-0000-0000-000000000001'), false, 'reset disables public quiz access');
select is((select count(*) from public.quiz_categories where event_id = 'a8000000-0000-0000-0000-000000000001'), 1::bigint, 'reset preserves categories');
select is((select count(*) from public.quiz_questions where category_id = 'a8200000-0000-0000-0000-000000000001'), 2::bigint, 'reset preserves questions');
select is((select count(*) from public.quiz_question_answers where question_id in ('a8300000-0000-0000-0000-000000000001','a8300000-0000-0000-0000-000000000002')), 2::bigint, 'reset preserves protected answers');
```

- [ ] **Step 2: Run pgTAP and verify the new tests fail because `reset_quiz` is absent**

Run:

```powershell
& '.\node_modules\.bin\supabase.cmd' test db
```

Expected: FAIL in the new `reset_quiz` contract and behavior assertions; existing assertions remain valid.

- [ ] **Step 3: Implement the migration**

Create `supabase/migrations/202610120001_reset_quiz.sql`:

```sql
create or replace function public.reset_quiz(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('quiz:' || p_event_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('score:' || p_event_id::text, 0));

  update public.teams team
  set points = team.points - quiz_scores.points
  from (
    select score.team_id, sum(score.points_delta)::integer as points
    from public.score_events score
    where score.event_id = p_event_id
      and score.source = 'quiz'
      and score.reversed_at is null
    group by score.team_id
  ) quiz_scores
  where team.id = quiz_scores.team_id
    and team.event_id = p_event_id;

  delete from public.quiz_answers answer
  using public.quiz_sessions session
  where answer.session_id = session.id
    and session.event_id = p_event_id;
  delete from public.quiz_sessions where event_id = p_event_id;
  update public.quiz_categories
  set status = 'available', chosen_by_team_id = null
  where event_id = p_event_id;
  delete from public.score_events where event_id = p_event_id and source = 'quiz';
  update public.events set quiz_enabled = false where id = p_event_id;
end;
$$;

revoke all on function public.reset_quiz(uuid) from public, anon;
grant execute on function public.reset_quiz(uuid) to authenticated;
```

- [ ] **Step 4: Apply only the pending migration and rerun pgTAP**

Run:

```powershell
& '.\node_modules\.bin\supabase.cmd' migration up --local
& '.\node_modules\.bin\supabase.cmd' test db
```

Expected: migration applies without resetting local Auth users; all `343` pgTAP assertions pass.

- [ ] **Step 5: Commit the database contract**

```powershell
git add supabase/migrations/202610120001_reset_quiz.sql supabase/tests/security.sql
git commit -m "feat: add atomic quiz reset"
```

### Task 2: Expose reset through both repositories

**Files:**
- Modify: `src/repositories/EventRepository.ts`
- Modify: `src/repositories/SupabaseEventRepository.ts`
- Modify: `src/repositories/SupabaseEventRepository.test.ts`
- Modify: `src/repositories/MemoryEventRepository.ts`
- Modify: `src/repositories/MemoryEventRepository.test.ts`
- Modify: `src/app/AppProviders.test.tsx`

- [ ] **Step 1: Write failing adapter and memory behavior tests**

In `SupabaseEventRepository.test.ts`, extend the organizer quiz mutation test:

```ts
await repository.resetQuiz("event-1");
expect(rpc).toHaveBeenLastCalledWith("reset_quiz", { p_event_id: "event-1" });
```

In `MemoryEventRepository.test.ts`, add:

```ts
it("réinitialise seulement le quiz et retire uniquement ses points", async () => {
  const repository = new MemoryEventRepository(makeEventSnapshot({
    event: makeEvent({ quizEnabled: true }),
    teams: [makeTeam({ points: 40, keys: 3, tieBreakPriority: 2 })],
    categories: [{ id: "category-1", eventId: "event-1", title: "Hiver", imageUrl: null, displayOrder: 0, status: "played", chosenByTeamId: "team-a" }],
    quizSession: { id: "session-1", eventId: "event-1", teamOrder: ["team-a"], currentTeamIndex: 1, activeCategoryId: null, activeQuestionIndex: 0, answerVisible: false, revealedAnswer: null, startedAt: "2026-12-18T10:00:00Z" },
  }), {});
  await repository.applyScore({ eventId: "event-1", teamId: "team-a", points: 5, keys: 0, source: "challenge", idempotencyKey: "challenge-1" });
  await repository.applyScore({ eventId: "event-1", teamId: "team-a", points: 10, keys: 0, source: "quiz", idempotencyKey: "quiz-1" });

  await repository.resetQuiz("event-1");

  const snapshot = await repository.getSnapshot("tournoi-des-arcanes");
  expect(snapshot.event.quizEnabled).toBe(false);
  expect(snapshot.teams[0]).toMatchObject({ points: 45, keys: 3, tieBreakPriority: 2 });
  expect(snapshot.categories[0]).toMatchObject({ status: "available", chosenByTeamId: null });
  expect(snapshot.quizSession).toBeNull();
});
```

Import `makeEvent` in this test file.

- [ ] **Step 2: Run the focused tests and verify they fail on the missing method**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/repositories/SupabaseEventRepository.test.ts src/repositories/MemoryEventRepository.test.ts
```

Expected: FAIL because `resetQuiz` does not exist.

- [ ] **Step 3: Add the repository contract and Supabase adapter**

Add to `EventRepository` beside the quiz actions:

```ts
resetQuiz(eventId: string): Promise<void>;
```

Add to `SupabaseEventRepository`:

```ts
async resetQuiz(eventId: string): Promise<void> {
  const result = await this.client.rpc("reset_quiz", { p_event_id: eventId }) as QueryResult<unknown>;
  if (result.error) throw new Error(result.error.message);
}
```

Add `resetQuiz: vi.fn()` to the complete typed repository double in `src/app/AppProviders.test.tsx`.

- [ ] **Step 4: Implement the in-memory score ledger and reset**

Replace the `Set` with a map that retains the input required for rollback:

```ts
private readonly appliedScores = new Map<string, Parameters<EventRepository["applyScore"]>[0]>();
```

In `applyScore`, replace the membership and insertion calls with:

```ts
if (this.appliedScores.has(input.idempotencyKey)) return;
this.appliedScores.set(input.idempotencyKey, structuredClone(input));
```

Add:

```ts
async resetQuiz(eventId: string): Promise<void> {
  const quizPointsByTeam = new Map<string, number>();
  for (const [key, score] of this.appliedScores) {
    if (score.eventId !== eventId || score.source !== "quiz") continue;
    quizPointsByTeam.set(score.teamId, (quizPointsByTeam.get(score.teamId) ?? 0) + score.points);
    this.appliedScores.delete(key);
  }
  this.snapshot = {
    ...this.snapshot,
    event: this.snapshot.event.id === eventId ? { ...this.snapshot.event, quizEnabled: false } : this.snapshot.event,
    teams: this.snapshot.teams.map((team) => team.eventId === eventId
      ? { ...team, points: team.points - (quizPointsByTeam.get(team.id) ?? 0) }
      : team),
    categories: this.snapshot.categories.map((category) => category.eventId === eventId
      ? { ...category, status: "available", chosenByTeamId: null }
      : category),
    quizSession: this.snapshot.quizSession?.eventId === eventId ? null : this.snapshot.quizSession,
  };
  this.emit();
}
```

- [ ] **Step 5: Run focused tests and TypeScript**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/repositories/SupabaseEventRepository.test.ts src/repositories/MemoryEventRepository.test.ts src/app/AppProviders.test.tsx
& '.\node_modules\.bin\tsc.cmd' -b
```

Expected: all focused tests pass and TypeScript exits with code `0`.

- [ ] **Step 6: Commit the repository boundary**

```powershell
git add src/repositories/EventRepository.ts src/repositories/SupabaseEventRepository.ts src/repositories/SupabaseEventRepository.test.ts src/repositories/MemoryEventRepository.ts src/repositories/MemoryEventRepository.test.ts src/app/AppProviders.test.tsx
git commit -m "feat: expose quiz reset through repositories"
```

### Task 3: Add the accessible admin reset control

**Files:**
- Modify: `src/features/admin/QuizControlPanel.tsx`
- Modify: `src/features/admin/QuizControlPanel.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Add `onReset: vi.fn()` to the base props. Add tests that open the confirmation, verify its explanatory copy, cancel with `Escape`, restore focus, call the action exactly once while pending, show success, and retain the dialog with a generic error on rejection. The core success test is:

```ts
it("confirme une seule réinitialisation et annonce sa réussite", async () => {
  const user = userEvent.setup();
  let finish!: () => void;
  const onReset = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<QuizControlPanel {...base} onReset={onReset} />);

  const trigger = screen.getByRole("button", { name: /^réinitialiser le quiz$/i });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: /confirmer la réinitialisation du quiz/i });
  expect(dialog).toHaveTextContent(/points attribués par le quiz/i);
  const confirm = within(dialog).getByRole("button", { name: /confirmer la réinitialisation/i });
  await user.click(confirm);
  expect(confirm).toBeDisabled();
  await user.click(confirm);
  expect(onReset).toHaveBeenCalledOnce();
  expect(onReset).toHaveBeenCalledWith("event-1");

  await act(async () => finish());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/quiz réinitialisé/i);
  expect(trigger).toHaveFocus();
});
```

Import `act` and `within` from Testing Library. Add a separate test that presses `Escape` and verifies `onReset` was not called, plus a rejection test that checks `Réinitialisation du quiz impossible. Réessayez.` without exposing the caught error.

- [ ] **Step 2: Run the component test and verify it fails**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/QuizControlPanel.test.tsx
```

Expected: FAIL because the reset button and `onReset` prop do not exist.

- [ ] **Step 3: Implement the confirmation flow**

Extend `Props`:

```ts
onReset(eventId: string): Promise<void>;
```

Add `useEffect`, `useRef`, and `KeyboardEvent` imports, then state for `confirming`, `resetState`, and the trigger ref. Define `const busy = pending || resetState === "saving"`, use it for every quiz command's `disabled` guard, and make both `run` and `reset` return immediately when busy. Implement `cancelReset`, `reset`, and the same two-button focus trap used by `ParticipantsEditor`. Restore focus after a successful reset with an effect:

```ts
useEffect(() => {
  if (resetState === "saved") resetReturnFocus.current?.focus();
}, [resetState]);
```

Render this block at the end of the `admin-quiz-control` section:

```tsx
<button
  ref={resetReturnFocus}
  type="button"
  className="admin-danger-button"
  disabled={busy}
  onClick={() => { setConfirming(true); setResetState("idle"); }}
>
  Réinitialiser le quiz
</button>
{confirming ? (
  <div
    className="admin-confirm"
    role="dialog"
    aria-modal="true"
    aria-label="Confirmer la réinitialisation du quiz"
    onKeyDown={(event) => {
      if (event.key === "Escape" && resetState !== "saving") cancelReset();
      else trapDialogFocus(event);
    }}
  >
    <p>La progression, les réponses et l’ordre de passage seront effacés.</p>
    <p>Les points attribués par le quiz seront retirés. Les défis, les clés, les thèmes et les questions seront conservés.</p>
    <p>L’accès public au quiz sera désactivé.</p>
    <button autoFocus type="button" disabled={resetState === "saving"} onClick={() => void reset()}>
      Confirmer la réinitialisation
    </button>
    <button type="button" disabled={resetState === "saving"} onClick={cancelReset}>Annuler</button>
  </div>
) : null}
{resetState === "saved" ? <p className="admin-save-status" role="status">Quiz réinitialisé.</p> : null}
{resetState === "error" ? <p className="admin-alert" role="alert">Réinitialisation du quiz impossible. Réessayez.</p> : null}
```

The `reset` function must guard against duplicate calls, await `props.onReset(props.event.id)`, and close only on success. The effect above restores focus after React removes the dialog.

- [ ] **Step 4: Run the component tests**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/QuizControlPanel.test.tsx
```

Expected: all `QuizControlPanel` tests pass.

- [ ] **Step 5: Commit the admin control**

```powershell
git add src/features/admin/QuizControlPanel.tsx src/features/admin/QuizControlPanel.test.tsx
git commit -m "feat: add quiz reset confirmation"
```

### Task 4: Wire the control into the admin workspace

**Files:**
- Modify: `src/features/admin/AdminApp.tsx`
- Modify: `src/features/admin/AdminWorkspace.test.tsx`

- [ ] **Step 1: Write the failing workspace integration test**

Allow `renderWorkspace` to accept a path argument and add the reset method to the repository test double. Then add:

```ts
it("raccorde la réinitialisation du quiz au dépôt", async () => {
  const user = userEvent.setup();
  const fake = makeWorkspaceRepository(vi.fn().mockResolvedValue([]));
  fake.repository.resetQuiz = vi.fn().mockResolvedValue(undefined);
  renderWorkspace(fake.repository, "/admin/quiz");

  await user.click(await screen.findByRole("button", { name: /^réinitialiser le quiz$/i }));
  await user.click(screen.getByRole("button", { name: /confirmer la réinitialisation/i }));

  expect(fake.repository.resetQuiz).toHaveBeenCalledWith(fake.initial.event.id);
});
```

- [ ] **Step 2: Run the workspace test and verify it fails**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/AdminWorkspace.test.tsx
```

Expected: FAIL because `QuizControlPanel` is not connected to `repository.resetQuiz`.

- [ ] **Step 3: Connect the action**

Pass this prop in the quiz route inside `AdminApp.tsx`:

```tsx
onReset={(eventId) => context.repository.resetQuiz(eventId)}
```

- [ ] **Step 4: Run workspace and quiz tests**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/AdminWorkspace.test.tsx src/features/admin/QuizControlPanel.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the wiring**

```powershell
git add src/features/admin/AdminApp.tsx src/features/admin/AdminWorkspace.test.tsx
git commit -m "feat: connect admin quiz reset"
```

### Task 5: Verify the complete feature

**Files:**
- Verify all files changed by Tasks 1–4.

- [ ] **Step 1: Run all automated checks**

```powershell
& '.\node_modules\.bin\vitest.cmd' --run
& '.\node_modules\.bin\supabase.cmd' test db
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\npm.cmd' run build
```

Expected: every Vitest and pgTAP test passes, TypeScript exits `0`, and Vite produces `dist` successfully. The existing bundle-size warning is acceptable; new errors are not.

- [ ] **Step 2: Exercise the original workflow in the browser**

On `http://127.0.0.1:4173/admin/quiz`:

1. verify the danger button is visible in **Pilotage en direct**;
2. open the dialog, confirm its explanatory copy, cancel with `Échap`, and verify focus returns;
3. create or use a local quiz session with at least one scored correct answer and one non-quiz score;
4. confirm the reset;
5. verify the success message, disabled access toggle, absence of a session, available themes, removed quiz points, and preserved non-quiz score and keys;
6. verify the public `/quiz` page returns to **Le quiz sera lancé par l’organisateur**.

- [ ] **Step 3: Inspect the final diff and worktree**

```powershell
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors and no unintended files. Commit any test-only correction separately with a focused message.
