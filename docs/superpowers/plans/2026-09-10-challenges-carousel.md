# Challenges Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la mosaïque des défis par un carrousel automatique, accessible et contenu dans un écran de projection 16:9.

**Architecture:** `ChallengesPage` conserve le tri des données et délègue l’interaction à un nouveau composant `ChallengesCarousel`. `ChallengeTile` reste responsable du rendu visuel d’un défi. Le carrousel ne monte qu’une tuile active, gère son index, le minuteur et les états de suspension, tandis que le CSS dimensionne la scène selon la hauteur disponible.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Afficher un seul défi et fournir les commandes manuelles

**Files:**
- Create: `src/features/challenges/ChallengesCarousel.tsx`
- Modify: `src/features/challenges/ChallengesPage.tsx`
- Modify: `src/features/challenges/ChallengeTile.tsx`
- Modify: `src/features/challenges/ChallengesPage.test.tsx`

- [x] **Step 1: Write failing tests**

Remplacer l’attente de cinq tuiles simultanées par des tests vérifiant que le premier défi trié est seul visible, que les cinq indicateurs existent, que suivant/précédent bouclent et que zéro ou un défi masque les commandes.

```tsx
expect(await screen.findByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
expect(screen.queryByRole("heading", { name: "Les remparts givrés" })).not.toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /afficher le défi/i })).toHaveLength(5);
await user.click(screen.getByRole("button", { name: /défi suivant/i }));
expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
```

- [x] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/features/challenges/ChallengesPage.test.tsx`

Expected: FAIL car la mosaïque rend encore les cinq tuiles et aucune commande.

- [x] **Step 3: Implement the manual carousel**

Créer `ChallengesCarousel` avec `activeIndex`, les fonctions modulaires `showPrevious`, `showNext` et `showAt`, une région `aria-roledescription="carrousel"`, les boutons précédent/suivant et un bouton indicateur par défi. Rendre un message `Aucun défi n’est encore disponible.` si la liste est vide et masquer les commandes si elle ne contient qu’un défi.

Modifier `ChallengesPage` pour rendre `<ChallengesCarousel challenges={challenges} />`. Simplifier `ChallengeTile` en supprimant la propriété `featured` et ajouter `aria-label={`Défi ${number} sur ${total} : ${challenge.title}`}`.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npm test -- --run src/features/challenges/ChallengesPage.test.tsx`

Expected: PASS pour l’affichage et la navigation manuelle.

### Task 2: Ajouter l’automatisme et l’accessibilité dynamique

**Files:**
- Modify: `src/features/challenges/ChallengesCarousel.tsx`
- Modify: `src/features/challenges/ChallengesPage.test.tsx`

- [x] **Step 1: Write failing timer and interaction tests**

Avec les faux minuteurs, vérifier le passage à 7 secondes, la boucle, pause/lecture, la suspension au survol et au focus, les flèches clavier, la remise à zéro du délai après navigation manuelle et le démarrage en pause avec `prefers-reduced-motion`.

```tsx
await act(async () => vi.advanceTimersByTimeAsync(7_000));
expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
fireEvent.keyDown(screen.getByRole("region", { name: /carrousel des défis/i }), { key: "ArrowLeft" });
expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
```

- [x] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/features/challenges/ChallengesPage.test.tsx`

Expected: FAIL car aucun minuteur ni état de pause n’existe.

- [x] **Step 3: Implement automatic behavior**

Ajouter un intervalle de `7_000` ms actif uniquement avec plusieurs défis, hors pause, survol, focus interne et réduction des animations. Ajouter les événements pointeur, focus et clavier, un bouton dont le libellé alterne entre `Mettre le carrousel en pause` et `Relancer le carrousel`, et recréer le minuteur après chaque navigation manuelle.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npm test -- --run src/features/challenges/ChallengesPage.test.tsx`

Expected: PASS pour tous les comportements du carrousel.

### Task 3: Adapter la présentation au vidéoprojecteur

**Files:**
- Modify: `src/features/challenges/challenges.css`
- Modify: `e2e/event-flow.spec.ts`

- [x] **Step 1: Add a failing 16:9 layout assertion**

À une fenêtre `1920 × 1080`, vérifier que le bas du carrousel reste au-dessus du bas de la fenêtre et que `document.documentElement.scrollHeight <= window.innerHeight` sur `/defis`.

```ts
expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
```

- [x] **Step 2: Run the focused E2E test and verify RED**

Run: `npm run test:e2e -- --grep "défis sans défilement"`

Expected: FAIL avec la mosaïque ou les dimensions actuelles.

- [x] **Step 3: Implement responsive carousel CSS**

Remplacer la grille par une scène unique. Sur écran large, utiliser une hauteur fondée sur la fenêtre, avec `min-height: 0`, des contrôles compacts et une tuile limitée à l’espace disponible. Sur écran étroit ou bas, rétablir une hauteur minimale et le défilement naturel. Ajouter une animation d’entrée désactivée sous `prefers-reduced-motion`.

- [x] **Step 4: Run all verification**

Run: `npm test -- --run`

Run: `npm run build`

Run: `npm run test:e2e -- --grep "défis sans défilement"`

Expected: tests, compilation et contrôle 16:9 réussis.

- [x] **Step 5: Verify locally and commit**

Contrôler `/defis` dans le navigateur local, puis :

```bash
git add src/features/challenges/ChallengesCarousel.tsx src/features/challenges/ChallengesPage.tsx src/features/challenges/ChallengeTile.tsx src/features/challenges/ChallengesPage.test.tsx src/features/challenges/challenges.css e2e/event-flow.spec.ts docs/superpowers/plans/2026-09-10-challenges-carousel.md
git commit -m "feat: add automatic challenges carousel"
```
