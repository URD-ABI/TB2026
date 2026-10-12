# Local Quiz Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fournir un jeu local de dix-huit questions et un parcours de quiz piloté par un organisateur authentifié, avec une représentation claire des thèmes terminés.

**Architecture:** Le parcours fonctionnel existant reste piloté par les RPC Supabase et l’état Realtime. Le seed local est enrichi sans ajouter de mode de démonstration parallèle, tandis que `CategoryGrid` reçoit un état visuel explicite pour les catégories `played`. La mise en situation finale utilise deux onglets contre la pile Supabase locale réelle.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Supabase/PostgreSQL, pgTAP, Playwright

---

### Task 1: Ajouter trois questions de démonstration par thème

**Files:**
- Create: `src/test/seedQuiz.test.ts`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the failing seed contract test**

Créer `src/test/seedQuiz.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import seed from "../../supabase/seed.sql?raw";

const categoryIds = [
  "50000000-0000-0000-0000-000000000011",
  "50000000-0000-0000-0000-000000000012",
  "50000000-0000-0000-0000-000000000013",
  "50000000-0000-0000-0000-000000000014",
  "50000000-0000-0000-0000-000000000015",
  "50000000-0000-0000-0000-000000000016",
];

function between(start: string, end: string): string {
  const section = seed.split(start)[1]?.split(end)[0];
  if (!section) throw new Error(`Section SQL introuvable : ${start}`);
  return section;
}

describe("local quiz seed", () => {
  it("définit trois questions ordonnées pour chacun des six thèmes", () => {
    const questions = between(
      "insert into public.quiz_questions",
      "insert into public.quiz_question_answers",
    );

    for (const categoryId of categoryIds) {
      expect(questions.match(new RegExp(categoryId, "g"))).toHaveLength(3);
    }
    expect(questions.match(/'60000000-0000-0000-0000-0000000000\d{2}'/g)).toHaveLength(18);
    expect(questions.match(/, 10, [012]\)/g)).toHaveLength(18);
  });

  it("définit une réponse protégée pour chacune des dix-huit questions", () => {
    const answers = between(
      "insert into public.quiz_question_answers",
      "insert into public.quiz_sessions",
    );
    expect(answers.match(/'60000000-0000-0000-0000-0000000000\d{2}'/g)).toHaveLength(18);
  });
});
```

- [ ] **Step 2: Run the seed test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/test/seedQuiz.test.ts
```

Expected: FAIL parce que chaque identifiant de catégorie n’apparaît qu’une fois dans le bloc des questions et que seuls six identifiants de question possèdent une réponse.

- [ ] **Step 3: Add the twelve missing questions and answers**

Remplacer les blocs `quiz_questions` et `quiz_question_answers` de `supabase/seed.sql` par dix-huit lignes. Conserver les six questions existantes comme première question et ajouter les contenus suivants :

```sql
insert into public.quiz_questions (id, category_id, prompt, points, display_order) values
  ('60000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000011', 'Combien de continents compte-t-on habituellement ?', 10, 0),
  ('60000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000011', 'Quelle est la capitale du Canada ?', 10, 1),
  ('60000000-0000-0000-0000-000000000018', '50000000-0000-0000-0000-000000000011', 'Quelle est la langue officielle du Brésil ?', 10, 2),
  ('60000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000012', 'Qui a réalisé le film Inception ?', 10, 0),
  ('60000000-0000-0000-0000-000000000019', '50000000-0000-0000-0000-000000000012', 'Dans quel film d’animation rencontre-t-on Elsa et Anna ?', 10, 1),
  ('60000000-0000-0000-0000-000000000020', '50000000-0000-0000-0000-000000000012', 'Quel acteur interprète Jack Sparrow ?', 10, 2),
  ('60000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000013', 'Quel groupe a chanté Bohemian Rhapsody ?', 10, 0),
  ('60000000-0000-0000-0000-000000000021', '50000000-0000-0000-0000-000000000013', 'Combien de notes compte une gamme diatonique ?', 10, 1),
  ('60000000-0000-0000-0000-000000000022', '50000000-0000-0000-0000-000000000013', 'Quel instrument possède généralement 88 touches ?', 10, 2),
  ('60000000-0000-0000-0000-000000000014', '50000000-0000-0000-0000-000000000014', 'Combien de joueurs une équipe de football aligne-t-elle sur le terrain ?', 10, 0),
  ('60000000-0000-0000-0000-000000000023', '50000000-0000-0000-0000-000000000014', 'Combien d’anneaux comporte le symbole olympique ?', 10, 1),
  ('60000000-0000-0000-0000-000000000024', '50000000-0000-0000-0000-000000000014', 'Quelle couleur porte le leader du Tour de France ?', 10, 2),
  ('60000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000015', 'Quelle planète est surnommée la planète rouge ?', 10, 0),
  ('60000000-0000-0000-0000-000000000025', '50000000-0000-0000-0000-000000000015', 'Quelle est la formule chimique de l’eau ?', 10, 1),
  ('60000000-0000-0000-0000-000000000026', '50000000-0000-0000-0000-000000000015', 'Quel gaz les plantes absorbent-elles principalement ?', 10, 2),
  ('60000000-0000-0000-0000-000000000016', '50000000-0000-0000-0000-000000000016', 'Quelle couleur obtient-on en mélangeant le bleu et le jaune ?', 10, 0),
  ('60000000-0000-0000-0000-000000000027', '50000000-0000-0000-0000-000000000016', 'Comment s’appelle le renne au nez rouge du Père Noël ?', 10, 1),
  ('60000000-0000-0000-0000-000000000028', '50000000-0000-0000-0000-000000000016', 'Quel est le principe d’un Secret Santa ?', 10, 2);

insert into public.quiz_question_answers (question_id, answer) values
  ('60000000-0000-0000-0000-000000000011', 'Sept'),
  ('60000000-0000-0000-0000-000000000017', 'Ottawa'),
  ('60000000-0000-0000-0000-000000000018', 'Le portugais'),
  ('60000000-0000-0000-0000-000000000012', 'Christopher Nolan'),
  ('60000000-0000-0000-0000-000000000019', 'La Reine des neiges'),
  ('60000000-0000-0000-0000-000000000020', 'Johnny Depp'),
  ('60000000-0000-0000-0000-000000000013', 'Queen'),
  ('60000000-0000-0000-0000-000000000021', 'Sept'),
  ('60000000-0000-0000-0000-000000000022', 'Le piano'),
  ('60000000-0000-0000-0000-000000000014', 'Onze'),
  ('60000000-0000-0000-0000-000000000023', 'Cinq'),
  ('60000000-0000-0000-0000-000000000024', 'Jaune'),
  ('60000000-0000-0000-0000-000000000015', 'Mars'),
  ('60000000-0000-0000-0000-000000000025', 'H₂O'),
  ('60000000-0000-0000-0000-000000000026', 'Le dioxyde de carbone'),
  ('60000000-0000-0000-0000-000000000016', 'Vert'),
  ('60000000-0000-0000-0000-000000000027', 'Rudolph'),
  ('60000000-0000-0000-0000-000000000028', 'Un échange anonyme de cadeaux');
```

- [ ] **Step 4: Run the seed test and verify GREEN**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/test/seedQuiz.test.ts src/test/seedTeams.test.ts
```

Expected: PASS pour le contrat des dix-huit questions et pour les identités d’équipe existantes.

- [ ] **Step 5: Commit**

```powershell
git add src/test/seedQuiz.test.ts supabase/seed.sql
git commit -m "test: expand local quiz questions"
```

### Task 2: Rendre les thèmes terminés immédiatement reconnaissables

**Files:**
- Modify: `src/features/quiz/QuizPage.test.tsx`
- Modify: `src/features/quiz/CategoryGrid.tsx`
- Modify: `src/features/quiz/quiz.css`

- [ ] **Step 1: Write the failing played-category test**

Étendre le test existant qui vérifie le thème Cinéma désactivé :

```tsx
const playedButton = await screen.findByRole("button", { name: /cinéma/i });
const playedCard = playedButton.closest("[data-testid='quiz-category']");
expect(playedButton).toBeDisabled();
expect(playedCard).toHaveClass("quiz-category--played");
expect(within(playedCard as HTMLElement).getByText("Thème terminé")).toBeInTheDocument();
expect(within(playedCard as HTMLElement).getByTestId("quiz-category-complete")).toHaveTextContent("✓");
```

Ajouter un cas distinct pour une catégorie seulement choisie mais pas encore terminée :

```tsx
expect(within(inProgressCard).getByText("Thème en cours")).toBeInTheDocument();
expect(inProgressCard).not.toHaveClass("quiz-category--played");
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/quiz/QuizPage.test.tsx
```

Expected: FAIL parce que la carte ne possède pas `quiz-category--played`, que la coche n’existe pas et que le libellé actuel est « Thème déjà choisi ».

- [ ] **Step 3: Implement the three category states**

Dans `CategoryGrid.tsx`, calculer les états avant le rendu de l’article :

```tsx
const isPlayed = category.status === "played";
const isInProgress = !isPlayed && category.chosenByTeamId !== null;
```

Construire la classe et les libellés ainsi :

```tsx
<article
  className={`quiz-category${background ? "" : " quiz-category--fallback"}${isPlayed ? " quiz-category--played" : ""}`}
  data-testid="quiz-category"
  key={category.id}
  style={background ? { "--quiz-category-image": background } as CSSProperties : undefined}
>
  <span className="quiz-category__number" aria-hidden="true">
    {String(index + 1).padStart(2, "0")}
  </span>
  {isPlayed ? (
    <span className="quiz-category__complete" data-testid="quiz-category-complete" aria-hidden="true">✓</span>
  ) : null}
  <button
    className="quiz-category__button"
    type="button"
    disabled={disabled(category) || pendingCategoryId !== null}
    onClick={() => onChoose(category)}
    aria-label={category.title}
  >
    <span>{category.title}</span>
    <small>{isPlayed ? "Thème terminé" : isInProgress ? "Thème en cours" : "Choisir ce thème"}</small>
  </button>
</article>
```

Dans `quiz.css`, ajouter :

```css
.quiz-category--played {
  border-color: rgba(232, 200, 117, 0.28);
  filter: saturate(0.32) brightness(0.62);
}

.quiz-category--played .quiz-category__button:disabled {
  filter: none;
  opacity: 1;
}

.quiz-category__complete {
  position: absolute;
  z-index: 1;
  top: 1rem;
  right: 1rem;
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border: 1px solid var(--brass-bright, #e8c875);
  border-radius: 50%;
  color: var(--brass-bright, #e8c875);
  background: rgba(5, 10, 23, 0.78);
  font-size: 1.35rem;
  font-weight: 800;
}
```

- [ ] **Step 4: Run the quiz component tests and verify GREEN**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/quiz/QuizPage.test.tsx
```

Expected: PASS pour la grille, la navigation directe vers la première question, les états terminé/en cours et la réponse révélée.

- [ ] **Step 5: Commit**

```powershell
git add src/features/quiz/QuizPage.test.tsx src/features/quiz/CategoryGrid.tsx src/features/quiz/quiz.css
git commit -m "feat: distinguish completed quiz themes"
```

### Task 3: Documenter et vérifier la répétition locale complète

**Files:**
- Modify: `docs/setup-supabase.md`
- Modify: `docs/rehearsal-checklist.md`

- [ ] **Step 1: Document the local organizer account without credentials**

Compléter `docs/setup-supabase.md` avec une section « Local quiz rehearsal » qui indique exactement :

```markdown
### Local quiz rehearsal

1. Open the local Studio URL printed by `supabase status`.
2. In **Authentication → Users**, create an email/password user chosen by the organizer.
3. Copy the generated user UUID.
4. In the SQL editor, run:

   ```sql
   insert into public.admin_users (user_id)
   values ('USER_UUID_FROM_AUTH_USERS')
   on conflict (user_id) do nothing;
   ```

5. Sign in at `/admin`, resolve any score/key ties in **Équipes et scores**, then start the session in **Quiz**.

Never commit the organizer email, password, local service-role key, or session tokens.
```

- [ ] **Step 2: Extend the rehearsal checklist with the multi-question flow**

Remplacer les étapes génériques du quiz dans `docs/rehearsal-checklist.md` par :

```markdown
- Ouvrir `/quiz` sur l’affichage public et `/admin/quiz` sur l’ordinateur de pilotage.
- Activer puis démarrer le quiz ; vérifier que l’ordre correspond au classement figé.
- Choisir un thème depuis l’écran public et vérifier l’ouverture immédiate de sa première question.
- Révéler puis valider successivement les trois réponses ; vérifier le passage automatique aux questions 2 et 3.
- Après la troisième réponse, vérifier le retour à la grille pour l’équipe suivante.
- Vérifier que le thème joué est assombri, coché, libellé « Thème terminé » et impossible à sélectionner.
- Vérifier qu’une bonne réponse ajoute 10 points et qu’une mauvaise réponse n’en ajoute aucun.
- Réinitialiser la répétition et vérifier que la session, les scores et les thèmes joués sont effacés sans supprimer les dix-huit questions éditoriales.
```

- [ ] **Step 3: Commit**

```powershell
git add docs/setup-supabase.md docs/rehearsal-checklist.md
git commit -m "docs: add local quiz rehearsal flow"
```

### Task 4: Verify the full project and run the local rehearsal

**Files:**
- No source changes expected

- [ ] **Step 1: Run the complete unit and build verification**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\node.exe' node_modules\vite\bin\vite.js build
```

Expected: all Vitest files pass, TypeScript exits with code 0, and Vite produces `dist/` successfully.

- [ ] **Step 2: Run the database contract tests**

Run:

```powershell
& '.\node_modules\.bin\supabase.cmd' test db
```

Expected: `supabase/tests/security.sql` passes, including multi-question advancement, correct-only scoring, idempotency, completed-category state and rehearsal reset.

- [ ] **Step 3: Ask before resetting the local database**

Explain that `supabase db reset` deletes the current local database contents and reconstructs them from migrations plus the updated seed. Do not continue until the user explicitly approves this destructive local reset.

- [ ] **Step 4: Rebuild the approved disposable local database**

After approval, run:

```powershell
& '.\node_modules\.bin\supabase.cmd' db reset
```

Expected: the local database is recreated with six categories, eighteen public questions, eighteen protected answers, five teams and an unstarted quiz session.

- [ ] **Step 5: Create the organizer account in Studio with user handoff**

Open the Studio URL returned by:

```powershell
& '.\node_modules\.bin\supabase.cmd' status
```

Navigate to **Authentication → Users**. Hand control to the user to enter their chosen email and password and to confirm account creation. Copy only the generated UUID, then ask for action-time confirmation before inserting it into `public.admin_users` because this grants administrator access.

- [ ] **Step 6: Run the two-screen rehearsal**

With the user’s authenticated `/admin/quiz` tab and a separate `/quiz` tab:

1. resolve the five-way score/key tie through the manual tie-break control;
2. start the quiz and verify that Gryffinzyme is announced as the first team according to the chosen manual order;
3. select Culture générale from the public grid;
4. reveal and mark the first answer correct, then verify question 2 and the 10-point score increase;
5. reveal and mark question 2 incorrect, then verify question 3 with no additional score;
6. reveal and validate question 3;
7. verify that the public grid returns for the next team and that Culture générale has the validated completed appearance and cannot be clicked.

- [ ] **Step 7: Run the public viewport checks**

Run:

```powershell
& '.\node_modules\.bin\playwright.cmd' test e2e/event-flow.spec.ts
```

Expected: the public navigation and layout pass on projection, portable and tablet projects. The projection-only no-scroll assertion remains skipped on tablet as designed.
