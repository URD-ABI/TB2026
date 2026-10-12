# Assignment Participant Portrait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher la photo uniquement pendant le passage et la révélation du participant, puis afficher ses initiales dans la composition de son équipe.

**Architecture:** Le composant `ParticipantPortrait` reste responsable du portrait central et du dialogue de résultat, avec son repli actuel vers les initiales. Le composant `ParticipantToken` devient indépendant de `photoUrl` et rend toujours une pastille d’initiales tout en conservant le nom accessible et l’animation d’arrivée.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite

---

### Task 1: Limiter la photo aux états de cérémonie

**Files:**
- Modify: `src/features/assignment/AssignmentPage.test.tsx`
- Modify: `src/features/assignment/AssignmentPage.tsx`

- [ ] **Step 1: Modifier les tests pour exprimer le nouveau comportement**

Dans le test `glisse automatiquement le portrait révélé dans la bonne composition`, remplacer les assertions qui attendent une image par des assertions qui exigent une pastille d’initiales et interdisent la photo dans l’équipe :

```tsx
it("glisse automatiquement les initiales du participant révélé dans la bonne composition", async () => {
  renderAssignment();
  await flushInitialSnapshot();

  fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
  await finishCeremony();

  const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
  const token = within(loups).getByLabelText("Alice Durand — Loups des mers");
  expect(token).toHaveTextContent(/^AD$/);
  expect(token).toHaveClass("participant-token--initials", "participant-token--new");
  expect(within(loups).queryByRole("img", { name: "Alice Durand — Loups des mers" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Benoît Leroy" })).toBeInTheDocument();
});
```

Dans le test `conserve brièvement l’animation du portrait dans la composition après la fermeture du résultat`, renommer le test et rechercher la pastille par son libellé :

```tsx
it("conserve brièvement l’animation des initiales dans la composition après la fermeture du résultat", async () => {
  renderAssignment();
  await flushInitialSnapshot();

  fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
  await finishCeremony();

  const resultOverlay = screen.getByRole("dialog", { name: /attribution de Alice Durand/i });
  fireEvent.click(within(resultOverlay).getByRole("button", { name: /participant suivant/i }));

  const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
  const token = within(loups).getByLabelText("Alice Durand — Loups des mers");
  expect(token).toHaveClass("participant-token--initials", "participant-token--new");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(token).not.toHaveClass("participant-token--new");
});
```

Dans le test `avance localement lorsque la révélation réussit avant le prochain instantané temps réel`, remplacer l’assertion sur l’image par :

```tsx
expect(within(loups).getByLabelText("Alice Durand — Loups des mers")).toHaveTextContent(/^AD$/);
```

Dans le test des mouvements réduits, remplacer l’assertion sur l’image par :

```tsx
expect(within(loups).getByLabelText("Alice Durand — Loups des mers"))
  .not.toHaveClass("participant-token--new");
```

Conserver le premier test `présente le premier participant non révélé, sa photo puis le bouton de tirage` : il protège explicitement la présence de la photo dans la case centrale.

- [ ] **Step 2: Exécuter le test ciblé et vérifier qu’il échoue pour la bonne raison**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/assignment/AssignmentPage.test.tsx
```

Expected: FAIL dans les assertions des compositions, car `ParticipantToken` rend encore une balise `img` lorsque `photoUrl` existe.

- [ ] **Step 3: Simplifier `ParticipantToken` pour toujours rendre les initiales**

Dans `src/features/assignment/AssignmentPage.tsx`, remplacer entièrement le corps conditionnel de `ParticipantToken` par :

```tsx
function ParticipantToken({
  participant,
  team,
  isNew,
}: {
  participant: Participant;
  team: Team;
  isNew: boolean;
}) {
  const label = `${participant.name} — ${team.name}`;
  const newClass = isNew ? " participant-token--new" : "";

  return (
    <span
      className={`participant-token participant-token--initials${newClass}`}
      aria-label={label}
      title={participant.name}
    >
      {initials(participant.name)}
    </span>
  );
}
```

Ne pas modifier `ParticipantPortrait` : il doit continuer à afficher `photoUrl` dans la case centrale et le dialogue de révélation, avec les initiales comme repli.

- [ ] **Step 4: Exécuter le test ciblé et vérifier qu’il passe**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/assignment/AssignmentPage.test.tsx
```

Expected: PASS pour tous les tests de `AssignmentPage.test.tsx`.

- [ ] **Step 5: Exécuter les vérifications globales**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\npm.cmd' run build
```

Expected: tous les tests passent, TypeScript ne signale aucune erreur et Vite produit la construction de production.

- [ ] **Step 6: Vérifier visuellement le parcours**

Dans la page locale `/attribution`, utiliser un participant possédant une photo et confirmer :

1. la photo apparaît au-dessus de son nom avant le tirage ;
2. la photo apparaît encore dans le dialogue de résultat ;
3. après « Participant suivant », la composition de l’équipe affiche `AD` et le nom accessible, sans image ;
4. le participant suivant apparaît normalement dans la case centrale.

- [ ] **Step 7: Commit**

```powershell
git add src/features/assignment/AssignmentPage.tsx src/features/assignment/AssignmentPage.test.tsx
git commit -m "feat: keep participant photos in ceremony only"
```
