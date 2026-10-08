# Score Adjustment Field Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contenir les champs Points et Clés de l’ajustement libre dans chaque carte d’équipe tout en gardant les deux champs côte à côte.

**Architecture:** Le correctif reste entièrement localisé dans les styles de `.score-controls__custom`. Un test de contrat CSS protège les contraintes qui neutralisent la largeur intrinsèque des champs numériques et placent le bouton sur la ligne complète.

**Tech Stack:** React 19, CSS Grid, TypeScript, Vitest, navigateur local Vite

---

### Task 1: Contenir les champs d’ajustement libre

**Files:**
- Create: `src/features/admin/adminStyles.test.ts`
- Modify: `src/features/admin/admin.css`

- [ ] **Step 1: Write the failing CSS contract test**

Créer `src/features/admin/adminStyles.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import adminStyles from "./admin.css?raw";

describe("admin score adjustment styles", () => {
  it("contient les champs numériques dans leurs colonnes et étend le bouton", () => {
    expect(adminStyles).toMatch(
      /\.score-controls__custom label\s*\{[^}]*min-width:\s*0;/s,
    );
    expect(adminStyles).toMatch(
      /\.score-controls__custom input\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s,
    );
    expect(adminStyles).toMatch(
      /\.score-controls__custom > button\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/adminStyles.test.ts
```

Expected: FAIL parce qu’aucune des trois règles ciblées n’existe encore.

- [ ] **Step 3: Add the minimal scoped CSS**

Ajouter après le bloc `.score-controls__custom` dans `src/features/admin/admin.css` :

```css
.score-controls__custom label {
  min-width: 0;
}

.score-controls__custom input {
  width: 100%;
  min-width: 0;
}

.score-controls__custom > button {
  grid-column: 1 / -1;
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/adminStyles.test.ts src/features/admin/TeamsEditor.test.tsx
```

Expected: PASS pour le contrat de largeur et les comportements existants de l’éditeur d’équipes.

- [ ] **Step 5: Build and verify the live layout**

Run:

```powershell
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\node.exe' node_modules\vite\bin\vite.js build
```

Redémarrer l’aperçu local, ouvrir `/admin/equipes` et mesurer le premier `.score-controls__custom`. Les bords droit et gauche de chaque `input` doivent rester compris dans les bords internes du `fieldset`, et le bouton « Appliquer » doit occuper la largeur des deux colonnes.

- [ ] **Step 6: Commit**

```powershell
git add src/features/admin/adminStyles.test.ts src/features/admin/admin.css
git commit -m "fix: contain score adjustment fields"
```
