# Public Team Name Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher uniquement les noms d’équipe, dans leur couleur, sur toutes les surfaces publiques.

**Architecture:** Le champ `emblem` reste dans le domaine et dans l’administration, mais les composants publics cessent de le rendre. Chaque surface publique transmet déjà `--team-color`; le dialogue de résultat recevra la même variable afin que tous les noms utilisent une règle CSS locale cohérente.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Corriger le classement

**Files:**
- Modify: `src/features/ranking/RankingPage.test.tsx`
- Modify: `src/features/ranking/TeamCylinder.tsx`
- Modify: `src/features/ranking/ranking.css`

- [x] **Step 1: Write the failing test**

Mettre à jour le test d’ordre visuel pour attendre uniquement les noms et vérifier l’absence des emblèmes :

```tsx
expect(cylinders.map((cylinder) => within(cylinder).getByRole("heading", { level: 2 }).textContent)).toEqual([
  "Lynx d’argent",
  "Hiboux de givre",
  "Cerfs dorés",
  "Renards de braise",
  "Loups des mers",
]);
expect(cylinders[0]).not.toHaveTextContent("✦");
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/ranking/RankingPage.test.tsx`

Expected: FAIL car chaque titre commence encore par l’emblème.

- [x] **Step 3: Write minimal implementation**

Dans `TeamCylinder.tsx`, rendre uniquement `{team.name}` dans le titre. Dans `ranking.css`, remplacer la couleur fixe du titre :

```css
.team-cylinder__name {
  color: var(--team-color);
  text-shadow: 0 0 6px color-mix(in srgb, var(--team-color) 62%, transparent);
}
```

Supprimer la règle `.team-cylinder__emblem` devenue inutilisée.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/ranking/RankingPage.test.tsx`

Expected: PASS.

### Task 2: Corriger toutes les surfaces d’attribution

**Files:**
- Modify: `src/features/assignment/AssignmentPage.test.tsx`
- Modify: `src/features/assignment/TeamReel.tsx`
- Modify: `src/features/assignment/AssignmentPage.tsx`
- Modify: `src/features/assignment/assignment.css`

- [x] **Step 1: Write the failing test**

Dans le test qui compte les cinq équipes, vérifier que les emblèmes `L`, `H`, `C`, `R` et `M` sont absents des équipes de la roue et des compositions. Dans le test du dialogue, vérifier que `M` est absent du résultat.

```tsx
for (const team of teams) {
  expect(within(reel).queryByText(team.emblem)).not.toBeInTheDocument();
  expect(within(compositions).queryByText(team.emblem)).not.toBeInTheDocument();
}
expect(within(resultOverlay).queryByText("M")).not.toBeInTheDocument();
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/assignment/AssignmentPage.test.tsx`

Expected: FAIL car les emblèmes sont encore présents sur les trois surfaces.

- [x] **Step 3: Write minimal implementation**

Dans `TeamReel.tsx`, supprimer le span d’emblème et ajouter `team-reel__name` au span du nom. Dans `AssignmentPage.tsx`, rendre uniquement le nom dans les compositions, supprimer l’emblème du résultat et fournir `--team-color` à la carte de résultat.

Dans `assignment.css`, supprimer les règles d’emblème et appliquer la couleur d’équipe aux noms :

```css
.team-reel__name,
.team-composition h2,
.assignment-result-overlay strong {
  color: var(--team-color);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/assignment/AssignmentPage.test.tsx`

Expected: PASS.

### Task 3: Vérification et enregistrement

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-team-name-display.md`

- [x] **Step 1: Run the full test suite**

Run: `npm test -- --run`

Expected: tous les tests réussissent.

- [x] **Step 2: Build the site**

Run: `npm run build`

Expected: TypeScript et Vite terminent avec un code de sortie nul.

- [x] **Step 3: Verify the local browser**

Contrôler le classement et l’attribution sur `http://127.0.0.1:4173/` : seuls les noms colorés doivent apparaître.

- [x] **Step 4: Commit**

```bash
git add src/features/ranking/RankingPage.test.tsx src/features/ranking/TeamCylinder.tsx src/features/ranking/ranking.css src/features/assignment/AssignmentPage.test.tsx src/features/assignment/TeamReel.tsx src/features/assignment/AssignmentPage.tsx src/features/assignment/assignment.css docs/superpowers/plans/2026-09-10-team-name-display.md
git commit -m "fix: show only colored team names"
```
