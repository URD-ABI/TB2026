# Multiple-Choice Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four ordered answer choices to every quiz question, let the active team select an answer until the administrator locks it, and score the locked answer automatically when it is revealed.

**Architecture:** Store choices in a protected normalized table and expose only safe public fields through an RPC. Keep the current selection, lock and revealed correct choice on the realtime quiz session. Split the live flow into public selection, admin lock, atomic reveal-and-score, and explicit admin advance commands.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Supabase/PostgreSQL, pgTAP, CSS.

---

## File map

- `src/domain/types.ts`: public/admin choice types and expanded quiz session state.
- `src/domain/quiz.ts`: pure validation for exactly four distinct choices and one correct answer.
- `src/domain/quiz.test.ts`: validation tests.
- `supabase/migrations/202610120002_quiz_multiple_choice.sql`: choice table, legacy-answer migration, session columns and safe public reading.
- `supabase/migrations/202610120003_quiz_multiple_choice_flow.sql`: validated admin editing and atomic live quiz commands.
- `supabase/tests/security.sql`: database permissions, state transitions, scoring and reset tests.
- `supabase/seed.sql`: four complete example choices per seeded question.
- `src/repositories/EventRepository.ts`: choice data and new command contracts.
- `src/repositories/SupabaseEventRepository.ts`: public/admin choice loading and RPC adapters.
- `src/repositories/SupabaseEventRepository.test.ts`: row mapping, RPC arguments and subscriptions.
- `src/repositories/MemoryEventRepository.ts`: local implementation of the same state machine.
- `src/repositories/MemoryEventRepository.test.ts`: local selection, locking, reveal, scoring, advance and reset tests.
- `src/features/admin/QuizEditor.tsx`: four answer inputs and correct-answer radio controls.
- `src/features/admin/QuizEditor.test.tsx`: editor validation and payload tests.
- `src/features/quiz/QuestionStage.tsx`: public 2 × 2 answer grid and visual states.
- `src/features/quiz/QuizPage.tsx`: public selection command and synchronization feedback.
- `src/features/quiz/QuizPage.test.tsx`: selection and reveal rendering tests.
- `src/features/quiz/quiz.css`: projected-screen answer grid and responsive states.
- `src/features/admin/QuizControlPanel.tsx`: lock, reveal and next-question controls.
- `src/features/admin/QuizControlPanel.test.tsx`: live admin state-machine tests.
- `src/features/admin/AdminApp.tsx`: new repository command wiring.
- `src/features/admin/AdminWorkspace.test.tsx`: admin integration test.
- `src/app/AppProviders.test.tsx`: complete repository mock contract.
- `src/test/fixtures.ts`: choice/session fixtures.
- `src/test/seedQuiz.test.ts`: seed contract assertions.

### Task 1: Domain types and choice validation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/quiz.ts`
- Test: `src/domain/quiz.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add tests that require exactly four non-empty, normalized-distinct choices and exactly one correct choice:

```ts
import { validateAdminQuizChoices } from "./quiz";

const validChoices = [
  { id: "a", questionId: "q", text: "Une baguette", displayOrder: 0, isCorrect: false },
  { id: "b", questionId: "q", text: "Un médaillon", displayOrder: 1, isCorrect: false },
  { id: "c", questionId: "q", text: "Une clé", displayOrder: 2, isCorrect: true },
  { id: "d", questionId: "q", text: "Un grimoire", displayOrder: 3, isCorrect: false },
];

expect(validateAdminQuizChoices(validChoices)).toEqual({ valid: true, reason: null });
expect(validateAdminQuizChoices(validChoices.slice(0, 3))).toEqual({ valid: false, reason: "choice_count" });
expect(validateAdminQuizChoices(validChoices.map((choice, index) => index === 3 ? { ...choice, text: " une CLÉ " } : choice))).toEqual({ valid: false, reason: "duplicate_choice" });
expect(validateAdminQuizChoices(validChoices.map((choice) => ({ ...choice, isCorrect: false })))).toEqual({ valid: false, reason: "correct_choice_count" });
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm run test:run -- src/domain/quiz.test.ts`

Expected: FAIL because `validateAdminQuizChoices` and the choice types do not exist.

- [ ] **Step 3: Add the types and minimal validator**

Add to `src/domain/types.ts`:

```ts
export type QuizChoice = {
  id: Id;
  questionId: Id;
  text: string;
  displayOrder: number;
};

export type AdminQuizChoice = QuizChoice & { isCorrect: boolean };

export type AdminQuizQuestion = QuizQuestion & { choices: AdminQuizChoice[] };

export type QuizSession = {
  id: Id;
  eventId: Id;
  teamOrder: Id[];
  currentTeamIndex: number;
  activeCategoryId: Id | null;
  activeQuestionIndex: number;
  selectedChoiceId: Id | null;
  choiceLocked: boolean;
  answerVisible: boolean;
  revealedChoiceId: Id | null;
  startedAt: string | null;
};
```

Replace the old `AdminQuizQuestion` answer string and `revealedAnswer` session field. Add to `src/domain/quiz.ts`:

```ts
export function validateAdminQuizChoices(choices: AdminQuizChoice[]) {
  if (choices.length !== 4 || choices.some((choice) => !choice.text.trim())) {
    return { valid: false as const, reason: "choice_count" as const };
  }
  const normalized = choices.map((choice) => choice.text.trim().toLocaleLowerCase("fr"));
  if (new Set(normalized).size !== 4) return { valid: false as const, reason: "duplicate_choice" as const };
  if (choices.filter((choice) => choice.isCorrect).length !== 1) {
    return { valid: false as const, reason: "correct_choice_count" as const };
  }
  return { valid: true as const, reason: null };
}
```

- [ ] **Step 4: Run the domain tests and confirm green**

Run: `npm run test:run -- src/domain/quiz.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/quiz.ts src/domain/quiz.test.ts
git commit -m "feat: model multiple choice quiz questions"
```

### Task 2: Database schema, protected choices and migration

**Files:**
- Create: `supabase/migrations/202610120002_quiz_multiple_choice.sql`
- Modify: `supabase/tests/security.sql`

- [ ] **Step 1: Add failing pgTAP assertions for schema and privacy**

Extend the test plan count and assert that anonymous users cannot read `is_correct` directly, while the public RPC returns only safe fields:

```sql
select has_table('public', 'quiz_question_choices', 'quiz choices table exists');
select has_column('public', 'quiz_sessions', 'selected_choice_id', 'session stores current choice');
select has_column('public', 'quiz_sessions', 'choice_locked', 'session stores lock');
select has_column('public', 'quiz_sessions', 'revealed_choice_id', 'session stores revealed correct choice');

set local role anon;
select throws_ok(
  $$select is_correct from public.quiz_question_choices limit 1$$,
  '42501', null,
  'anonymous users cannot inspect correct choices'
);
select lives_ok(
  $$select * from public.get_public_quiz_choices('00000000-0000-0000-0000-000000000001')$$,
  'anonymous users can load safe choices'
);
reset role;
```

- [ ] **Step 2: Run database tests and confirm red**

Run: `.\node_modules\.bin\supabase.cmd test db`

Expected: FAIL because the table, columns and function do not exist.

- [ ] **Step 3: Create the normalized choice schema and migrate old answers**

Create the migration with this core schema:

```sql
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
select question_id, answer, 0, true from public.quiz_question_answers;

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
```

Enable RLS, grant direct table access only to authenticated administrators through policy, and define a security-definer `get_public_quiz_choices(p_event_id uuid)` returning `id`, `question_id`, `choice_text`, and `display_order`, never `is_correct`. Drop `quiz_question_answers` only after the admin RPCs in Task 3 no longer reference it.

- [ ] **Step 4: Apply the migration and run pgTAP**

Run:

```powershell
.\node_modules\.bin\supabase.cmd migration up --local
.\node_modules\.bin\supabase.cmd test db
```

Expected: the new schema/privacy assertions pass and the legacy admin-question functions continue to work until Task 3 replaces them.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610120002_quiz_multiple_choice.sql supabase/tests/security.sql
git commit -m "feat: store protected quiz choices"
```

### Task 3: Database quiz state machine and automatic scoring

**Files:**
- Create: `supabase/migrations/202610120003_quiz_multiple_choice_flow.sql`
- Modify: `supabase/tests/security.sql`

- [ ] **Step 1: Add failing state-machine tests**

Add pgTAP transactions proving:

```sql
select lives_ok(
  $$select public.select_quiz_choice(:'session_id', :'question_id', :'choice_b_id')$$,
  'the team can select a public choice'
);
select is((select selected_choice_id from public.quiz_sessions where id = :'session_id'), :'choice_b_id'::uuid, 'selection is stored');
select lives_ok($$select public.lock_quiz_choice(:'session_id', :'question_id')$$, 'admin locks a selected choice');
select throws_ok(
  $$select public.select_quiz_choice(:'session_id', :'question_id', :'choice_c_id')$$,
  'P0001', 'choice_locked', 'selection cannot change after lock'
);
select lives_ok($$select public.reveal_and_score_quiz_answer(:'session_id', :'question_id')$$, 'admin reveals and scores');
select is((select count(*) from public.score_events where source = 'quiz' and team_id = :'team_id'), 0::bigint, 'wrong answer awards no points');
select lives_ok($$select public.advance_quiz_question(:'session_id', :'question_id')$$, 'admin advances explicitly');
```

Add a second correct-answer case, call reveal twice, and assert exactly one active quiz score event exists.

- [ ] **Step 2: Run pgTAP and confirm red**

Run: `.\node_modules\.bin\supabase.cmd test db`

Expected: FAIL because the four new commands do not exist.

- [ ] **Step 3: Implement the four atomic commands**

Implement these signatures in the new flow migration:

```sql
public.select_quiz_choice(p_session_id uuid, p_question_id uuid, p_choice_id uuid) returns void
public.lock_quiz_choice(p_session_id uuid, p_question_id uuid) returns void
public.reveal_and_score_quiz_answer(p_session_id uuid, p_question_id uuid) returns void
public.advance_quiz_question(p_session_id uuid, p_question_id uuid) returns void
```

Each command must lock the session row, resolve the active question by category and index, and reject mismatches. Selection verifies `events.quiz_enabled`, membership of the choice in the active question, `choice_locked = false`, and `answer_visible = false`. Lock requires a selected choice. Reveal requires a lock, derives correctness inside the database, inserts `quiz_answers`, and calls `apply_score_event` only for a correct result with a deterministic idempotency UUID based on session and question. Advance requires `answer_visible = true`, then either increments the question index or marks the category played and increments the team index.

Reset `selected_choice_id`, `choice_locked`, `answer_visible`, and `revealed_choice_id` whenever the active question changes.

- [ ] **Step 4: Replace validation and admin question RPCs**

Update `start_quiz` to reject any event question for which this query is true:

```sql
select 1
from public.quiz_questions q
left join public.quiz_question_choices c on c.question_id = q.id
where q.category_id in (select id from public.quiz_categories where event_id = p_event_id)
group by q.id
having count(c.id) <> 4
   or count(*) filter (where btrim(c.choice_text) = '') > 0
   or count(distinct lower(btrim(c.choice_text))) <> 4
   or count(*) filter (where c.is_correct) <> 1;
```

Replace the admin functions with these explicit JSON contracts:

```sql
public.get_admin_quiz_questions(p_event_id uuid)
returns table(id uuid, category_id uuid, prompt text, points integer, display_order integer, choices jsonb)

public.create_quiz_question(
  p_question_id uuid,
  p_category_id uuid,
  p_prompt text,
  p_points integer,
  p_display_order integer,
  p_choices jsonb
) returns void

public.update_quiz_question(
  p_question_id uuid,
  p_category_id uuid,
  p_prompt text,
  p_points integer,
  p_choices jsonb
) returns void
```

Each element of `p_choices` must have `id`, `text`, `displayOrder`, and `isCorrect`. Validate the array length, trimmed uniqueness, positions 0–3 and unique correct marker before replacing the question choices in one transaction. After the replacement functions compile, drop `quiz_question_answers`, revoke the old reveal/answer functions, and grant only public selection to `anon`; all other new commands require `authenticated` plus `is_admin()`.

- [ ] **Step 5: Extend reset behavior**

Update `reset_quiz` so session deletion clears all selection/lock state naturally and the existing quiz score cleanup remains unchanged. Add an assertion that choices survive reset.

- [ ] **Step 6: Run pgTAP and confirm green**

Run: `.\node_modules\.bin\supabase.cmd test db`

Expected: all database tests pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202610120003_quiz_multiple_choice_flow.sql supabase/tests/security.sql
git commit -m "feat: add atomic multiple choice quiz flow"
```

### Task 4: Repository contracts and Supabase adapter

**Files:**
- Modify: `src/repositories/EventRepository.ts`
- Modify: `src/repositories/SupabaseEventRepository.ts`
- Test: `src/repositories/SupabaseEventRepository.test.ts`
- Modify: `src/app/AppProviders.test.tsx`

- [ ] **Step 1: Write failing mapper and RPC tests**

Define rows with `choice_text`, `display_order`, session selection fields and admin `is_correct`. Assert safe mapping and exact calls:

```ts
expect(mapQuizChoiceRow(choiceRow)).toEqual({
  id: "choice-c", questionId: "question-1", text: "Une clé", displayOrder: 2,
});
expect(mapQuizSessionRow(sessionRow)).toEqual(expect.objectContaining({
  selectedChoiceId: "choice-c", choiceLocked: true, revealedChoiceId: null,
}));

await repository.selectQuizChoice("session-1", "question-1", "choice-c");
await repository.lockQuizChoice("session-1", "question-1");
await repository.revealAndScoreQuizAnswer("session-1", "question-1");
await repository.advanceQuizQuestion("session-1", "question-1");

expect(rpc).toHaveBeenCalledWith("select_quiz_choice", {
  p_session_id: "session-1", p_question_id: "question-1", p_choice_id: "choice-c",
});
```

- [ ] **Step 2: Run focused tests and confirm red**

Run: `npm run test:run -- src/repositories/SupabaseEventRepository.test.ts src/app/AppProviders.test.tsx`

Expected: FAIL because the mapper, choice snapshot field and methods do not exist.

- [ ] **Step 3: Expand the repository contract**

Add `choices: QuizChoice[]` to `EventSnapshot` and replace the old live methods with:

```ts
selectQuizChoice(sessionId: string, questionId: string, choiceId: string): Promise<void>;
lockQuizChoice(sessionId: string, questionId: string): Promise<void>;
revealAndScoreQuizAnswer(sessionId: string, questionId: string): Promise<void>;
advanceQuizQuestion(sessionId: string, questionId: string): Promise<void>;
```

Keep create/update question inputs based on `AdminQuizQuestion`, including its four choices.

- [ ] **Step 4: Implement Supabase loading and RPC adapters**

Load public choices using `get_public_quiz_choices` as part of `getSnapshot`. Map admin questions with nested choices returned by the admin RPC. Serialize choices for create/update as:

```ts
const p_choices = question.choices.map((choice) => ({
  id: choice.id,
  text: choice.text.trim(),
  displayOrder: choice.displayOrder,
  isCorrect: choice.isCorrect,
}));
```

Add the four method adapters with the exact parameter names from Step 1. Subscribe to `quiz_question_choices` changes only for authenticated admin refreshes; session changes already deliver public live-state updates.

- [ ] **Step 5: Complete all repository mocks and run tests**

Add `vi.fn()` implementations for all four methods to test repositories.

Run: `npm run test:run -- src/repositories/SupabaseEventRepository.test.ts src/app/AppProviders.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/EventRepository.ts src/repositories/SupabaseEventRepository.ts src/repositories/SupabaseEventRepository.test.ts src/app/AppProviders.test.tsx
git commit -m "feat: expose multiple choice quiz commands"
```

### Task 5: Memory repository state machine

**Files:**
- Modify: `src/repositories/MemoryEventRepository.ts`
- Test: `src/repositories/MemoryEventRepository.test.ts`
- Modify: `src/test/fixtures.ts`

- [ ] **Step 1: Write failing local-flow tests**

Create four fixture choices, then assert:

```ts
await repository.selectQuizChoice("session-1", "question-1", "choice-b");
expect(repository.current().quizSession?.selectedChoiceId).toBe("choice-b");
await repository.selectQuizChoice("session-1", "question-1", "choice-c");
expect(repository.current().quizSession?.selectedChoiceId).toBe("choice-c");
await repository.lockQuizChoice("session-1", "question-1");
await expect(repository.selectQuizChoice("session-1", "question-1", "choice-b")).rejects.toThrow("choice_locked");
await repository.revealAndScoreQuizAnswer("session-1", "question-1");
expect(repository.current().teams[0].points).toBe(10);
await repository.revealAndScoreQuizAnswer("session-1", "question-1");
expect(repository.current().teams[0].points).toBe(10);
```

Add advance and reset assertions.

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm run test:run -- src/repositories/MemoryEventRepository.test.ts`

Expected: FAIL because the memory repository lacks the new methods.

- [ ] **Step 3: Implement the local state machine**

Mirror the database guards and transitions. Store answered question IDs in a set to make reveal idempotent. On correct reveal, add the question points once. On advance, clear selection, lock and reveal fields before moving. On reset, remove only locally recorded quiz points and retain choice definitions.

- [ ] **Step 4: Run the focused tests and confirm green**

Run: `npm run test:run -- src/repositories/MemoryEventRepository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/MemoryEventRepository.ts src/repositories/MemoryEventRepository.test.ts src/test/fixtures.ts
git commit -m "feat: simulate multiple choice quiz locally"
```

### Task 6: Four-choice admin editor

**Files:**
- Modify: `src/features/admin/QuizEditor.tsx`
- Test: `src/features/admin/QuizEditor.test.tsx`
- Modify: `src/features/admin/admin.css`

- [ ] **Step 1: Write failing editor tests**

Assert that an existing question renders four labeled text fields and four correct-answer radios, and that save emits trimmed choices in display order:

```ts
expect(screen.getAllByRole("textbox", { name: /Réponse [A-D]/ })).toHaveLength(4);
expect(screen.getAllByRole("radio", { name: /Bonne réponse [A-D]/ })).toHaveLength(4);
await user.click(screen.getByRole("radio", { name: "Bonne réponse C" }));
await user.click(screen.getByRole("button", { name: "Enregistrer la question" }));
expect(onUpdateQuestion).toHaveBeenCalledWith(expect.objectContaining({
  choices: expect.arrayContaining([expect.objectContaining({ displayOrder: 2, isCorrect: true })]),
}));
```

Assert save remains disabled for blanks, duplicates or no correct choice and displays a specific French validation message.

- [ ] **Step 2: Run the editor test and confirm red**

Run: `npm run test:run -- src/features/admin/QuizEditor.test.tsx`

Expected: FAIL because the form still has one answer textarea.

- [ ] **Step 3: Build a focused choice editor**

Inside `QuizEditor.tsx`, add a `ChoiceFields` component receiving `choices` and `onChange`. Render letters with `String.fromCharCode(65 + displayOrder)`, text inputs, and one radio group per question. Use `validateAdminQuizChoices` to disable submit and select the French message:

```ts
const messages = {
  choice_count: "Renseignez quatre réponses.",
  duplicate_choice: "Les quatre réponses doivent être différentes.",
  correct_choice_count: "Choisissez une seule bonne réponse.",
};
```

New questions start with four stable client IDs, positions 0–3, empty text and response A selected as correct. Keep question points and ordering controls unchanged.

- [ ] **Step 4: Style the editor and run tests**

Add a compact two-column `.admin-choice-grid` above 900 px and one column below it. Keep inputs within the question card.

Run: `npm run test:run -- src/features/admin/QuizEditor.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/QuizEditor.tsx src/features/admin/QuizEditor.test.tsx src/features/admin/admin.css
git commit -m "feat: edit four quiz choices per question"
```

### Task 7: Public 2 × 2 answer grid

**Files:**
- Modify: `src/features/quiz/QuestionStage.tsx`
- Modify: `src/features/quiz/QuizPage.tsx`
- Test: `src/features/quiz/QuizPage.test.tsx`
- Modify: `src/features/quiz/quiz.css`

- [ ] **Step 1: Write failing interaction and state tests**

Cover selection, replacement, lock and reveal:

```ts
await user.click(screen.getByRole("button", { name: "B — Un médaillon" }));
expect(repository.selectQuizChoice).toHaveBeenCalledWith("session-1", "question-1", "choice-b");

renderQuiz({ quizSession: lockedSession });
expect(screen.getByRole("button", { name: "B — Un médaillon" })).toBeDisabled();
expect(screen.getByText("Choix verrouillé")).toBeInTheDocument();

renderQuiz({ quizSession: wrongRevealedSession });
expect(screen.getByRole("button", { name: "B — Un médaillon" })).toHaveClass("question-choice--wrong");
expect(screen.getByRole("button", { name: "C — Une clé" })).toHaveClass("question-choice--correct");
```

Also assert a correct selected choice is green and the correct choice is not identifiable before reveal.

- [ ] **Step 2: Run the public quiz test and confirm red**

Run: `npm run test:run -- src/features/quiz/QuizPage.test.tsx`

Expected: FAIL because no answer buttons exist.

- [ ] **Step 3: Implement `QuestionStage` states**

Pass sorted choices, selected ID, lock/reveal state, pending selection and `onSelect`. Render four buttons with A–D labels. Derive classes only from session state:

```ts
const selected = choice.id === selectedChoiceId;
const correct = answerVisible && choice.id === revealedChoiceId;
const wrong = answerVisible && selected && !correct;
```

Disable buttons while saving, locked or revealed. Add `aria-pressed`, visible status text and an `aria-live="polite"` result message.

- [ ] **Step 4: Wire optimistic-but-confirmed selection**

In `QuizPage`, keep `pendingChoiceId` during the request. Call `repository.selectQuizChoice`; on failure retain a local highlighted choice with the message « Sélection non synchronisée, réessayez. » and provide a retry button. Clear the local pending/error state when the snapshot confirms the selected ID.

- [ ] **Step 5: Add projector-first CSS**

Implement `.question-stage__choices` as a 2 × 2 grid with large buttons, gold selected/locked state, green correct state and red wrong state. Use icon/text markers as well as color. Switch to one column under the existing mobile breakpoint.

- [ ] **Step 6: Run public tests and commit**

Run: `npm run test:run -- src/features/quiz/QuizPage.test.tsx`

Expected: PASS.

```bash
git add src/features/quiz/QuestionStage.tsx src/features/quiz/QuizPage.tsx src/features/quiz/QuizPage.test.tsx src/features/quiz/quiz.css
git commit -m "feat: let teams choose quiz answers"
```

### Task 8: Admin live lock, reveal and advance controls

**Files:**
- Modify: `src/features/admin/QuizControlPanel.tsx`
- Test: `src/features/admin/QuizControlPanel.test.tsx`
- Modify: `src/features/admin/admin.css`

- [ ] **Step 1: Write failing control-state tests**

Assert the exact state transitions:

```ts
expect(screen.getByRole("button", { name: "Verrouiller le choix" })).toBeDisabled();

renderPanel({ session: { ...session, selectedChoiceId: "choice-b" } });
expect(screen.getByText("Choix actuel : B — Un médaillon")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Verrouiller le choix" }));
expect(onLock).toHaveBeenCalledWith("session-1", "question-1");

renderPanel({ session: { ...session, selectedChoiceId: "choice-b", choiceLocked: true } });
await user.click(screen.getByRole("button", { name: "Révéler la réponse" }));
expect(onRevealAndScore).toHaveBeenCalledWith("session-1", "question-1");

renderPanel({ session: { ...session, answerVisible: true, revealedChoiceId: "choice-c" } });
await user.click(screen.getByRole("button", { name: "Question suivante" }));
expect(onAdvance).toHaveBeenCalledWith("session-1", "question-1");
```

- [ ] **Step 2: Run the panel test and confirm red**

Run: `npm run test:run -- src/features/admin/QuizControlPanel.test.tsx`

Expected: FAIL because the panel still uses manual correct/incorrect buttons.

- [ ] **Step 3: Replace manual adjudication controls**

Show the live selected letter/text. Render only the action valid for the current state:

- no lock: « Verrouiller le choix », disabled without selection;
- locked and hidden: « Révéler la réponse »;
- revealed: result summary and « Question suivante ».

Remove « Bonne réponse » and « Mauvaise réponse ». Reuse the shared pending/error handling so one command can run at a time.

- [ ] **Step 4: Run the panel tests and commit**

Run: `npm run test:run -- src/features/admin/QuizControlPanel.test.tsx`

Expected: PASS.

```bash
git add src/features/admin/QuizControlPanel.tsx src/features/admin/QuizControlPanel.test.tsx src/features/admin/admin.css
git commit -m "feat: control quiz answer locking and reveal"
```

### Task 9: Application wiring, seed data and integration

**Files:**
- Modify: `src/features/admin/AdminApp.tsx`
- Test: `src/features/admin/AdminWorkspace.test.tsx`
- Modify: `supabase/seed.sql`
- Test: `src/test/seedQuiz.test.ts`

- [ ] **Step 1: Write failing wiring and seed tests**

In `AdminWorkspace.test.tsx`, render `/admin/quiz`, provide a selected choice, and assert the lock button calls the repository. In `seedQuiz.test.ts`, require the dedicated table and four choice rows per seeded question:

```ts
expect(seedSql).toContain("insert into public.quiz_question_choices");
expect(seedSql).not.toContain("insert into public.quiz_question_answers");
expect(seedSql.match(/00000000-0000-0000-0000-000000000301/g)?.length).toBeGreaterThanOrEqual(4);
```

- [ ] **Step 2: Run integration tests and confirm red**

Run: `npm run test:run -- src/features/admin/AdminWorkspace.test.tsx src/test/seedQuiz.test.ts`

Expected: FAIL because `AdminApp` and seed data still use the old contract.

- [ ] **Step 3: Wire the four live commands**

Pass `snapshot.choices` into the panel and editor data where needed. Wire:

```tsx
onLock={(sessionId, questionId) => repository.lockQuizChoice(sessionId, questionId)}
onRevealAndScore={(sessionId, questionId) => repository.revealAndScoreQuizAnswer(sessionId, questionId)}
onAdvance={(sessionId, questionId) => repository.advanceQuizQuestion(sessionId, questionId)}
```

The public page calls `selectQuizChoice` directly through its repository context.

- [ ] **Step 4: Replace seeded protected answers with complete choices**

For every seeded question, insert four deterministic choice UUIDs and texts, with one `is_correct = true` and display orders 0–3. Keep the existing correct answer text and add three plausible distractors. Remove inserts into the dropped legacy answer table.

- [ ] **Step 5: Run focused integration tests and commit**

Run: `npm run test:run -- src/features/admin/AdminWorkspace.test.tsx src/test/seedQuiz.test.ts`

Expected: PASS.

```bash
git add src/features/admin/AdminApp.tsx src/features/admin/AdminWorkspace.test.tsx supabase/seed.sql src/test/seedQuiz.test.ts
git commit -m "feat: integrate multiple choice quiz flow"
```

### Task 10: Full verification and browser rehearsal

**Files:**
- Modify only files required by failures found during this task.

- [ ] **Step 1: Reset the disposable local database and verify migrations**

Run:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db
```

Expected: reset succeeds and all pgTAP tests pass. Recreate the local admin test account if the reset removes it.

- [ ] **Step 2: Run all application checks**

Run:

```powershell
npm run test:run
npm run build
```

Expected: all Vitest files pass and the production build exits 0.

- [ ] **Step 3: Rehearse the end-to-end flow locally**

Start the preview and verify on separate public/admin tabs:

1. Admin cannot start with an incomplete migrated question.
2. Completing four choices enables a valid start.
3. Public selection appears in admin live controls.
4. Public selection can change before lock.
5. Lock prevents further changes.
6. Wrong reveal produces red selected and green correct cases with no score.
7. Correct reveal produces green selected and adds points once.
8. Refreshing or clicking reveal again does not duplicate points.
9. « Question suivante » advances exactly once.
10. Reset removes progress and quiz points but preserves choices.

- [ ] **Step 4: Run the final diff checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intentional changes remain.

- [ ] **Step 5: Commit any verification fixes**

```bash
git add src supabase
git commit -m "fix: finalize multiple choice quiz flow"
```

Skip this commit when verification required no code changes.
