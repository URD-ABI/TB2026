# Challenges Status Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Masquer visuellement l’annonce accessible « Défi X sur 5 » afin qu’elle ne crée plus d’espace avant la tuile active.

**Architecture:** Conserver l’annonce `aria-live` dans `ChallengesCarousel` et définir l’utilitaire CSS global déjà référencé par le composant. Un contrôle Playwright mesurera sa boîte visuelle pour protéger à la fois l’accessibilité et la mise en page.

**Tech Stack:** React 19, CSS, Playwright, Vitest, Vite

---

### Task 1: Retirer l’annonce accessible de la mise en page visible

**Files:**
- Modify: `e2e/event-flow.spec.ts`
- Modify: `src/styles/global.css`

- [x] **Step 1: Write the failing browser test**

Dans le test de projection du carrousel, conserver la vérification du contenu accessible puis mesurer la boîte de `.visually-hidden` :

```ts
const accessibleStatus = page.locator(".challenges-carousel .visually-hidden");
await expect(accessibleStatus).toContainText(/Défi \d sur 5/);
const statusBox = await accessibleStatus.boundingBox();
expect(statusBox).not.toBeNull();
expect(statusBox?.width).toBeLessThanOrEqual(1);
expect(statusBox?.height).toBeLessThanOrEqual(1);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\playwright.cmd' test e2e/event-flow.spec.ts --project=portable-1366 --grep "carrousel des défis"
```

Expected: FAIL parce que le paragraphe n’est pas découpé visuellement et sa largeur ou sa hauteur dépasse un pixel.

- [x] **Step 3: Add the minimal accessible hiding utility**

Ajouter dans `src/styles/global.css`, près des styles structurels globaux :

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}
```

Cette règle ne doit pas utiliser `display: none` ou `visibility: hidden`, afin que l’annonce reste exposée aux lecteurs d’écran.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
& '.\node_modules\.bin\playwright.cmd' test e2e/event-flow.spec.ts --project=portable-1366 --grep "carrousel des défis"
```

Expected: PASS ; l’annonce mesure au maximum un pixel dans les deux axes et la page reste contenue dans 1366 × 768.

- [x] **Step 5: Run full verification**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\node.exe' node_modules\vite\bin\vite.js build
& '.\node_modules\.bin\playwright.cmd' test e2e/event-flow.spec.ts
```

Expected: 189 tests unitaires réussis, compilation TypeScript et Vite réussie, parcours Playwright réussi sur les formats projection, portable et tablette avec le seul saut explicitement prévu pour l’absence de défilement sur tablette.

- [x] **Step 6: Commit**

```powershell
git add e2e/event-flow.spec.ts src/styles/global.css docs/superpowers/plans/2026-09-10-challenges-status-spacing.md
git commit -m "fix: remove challenge status spacing"
```
