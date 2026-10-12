# Team Identities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les noms des cinq équipes et appliquer le vert émeraude validé à Slythermers dans les données locales initiales.

**Architecture:** Les identités d’équipe sont définies dans `supabase/seed.sql` puis consommées par toutes les pages via le dépôt d’événement. La modification reste donc limitée à cette source de données, avec un test de contrat ciblé pour empêcher une régression des noms, couleurs, emblèmes et ordre.

**Tech Stack:** SQL Supabase, Vitest, TypeScript

---

### Task 1: Mettre à jour les identités d’équipe locales

**Files:**
- Create: `src/test/seedTeams.test.ts`
- Modify: `supabase/seed.sql:11-16`

- [x] **Step 1: Write the failing test**

Créer `src/test/seedTeams.test.ts` avec un test qui lit `supabase/seed.sql` et vérifie les cinq lignes exactes :

```ts
import { describe, expect, it } from "vitest";
import seed from "../../supabase/seed.sql?raw";

describe("local team seed", () => {
  it("defines the approved team identities in display order", () => {
    expect(seed).toContain("'Gryffinzyme', '#D1495B', 'mountain', 0");
    expect(seed).toContain("'Slythermers', '#1F7A4D', 'constellation', 1");
    expect(seed).toContain("'Hufflespin', '#EDAE49', 'wind', 2");
    expect(seed).toContain("'Ravenflow', '#30638E', 'lightning', 3");
    expect(seed).toContain("'Order of the Phenol', '#7A3B69', 'flame', 4");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/test/seedTeams.test.ts`

Expected: FAIL car `supabase/seed.sql` contient encore Atlas, Orion, Sirocco, Volt et Ember.

- [x] **Step 3: Write minimal implementation**

Dans `supabase/seed.sql`, remplacer uniquement les cinq valeurs de nom et la couleur d’Orion :

```sql
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Gryffinzyme', '#D1495B', 'mountain', 0),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Slythermers', '#1F7A4D', 'constellation', 1),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Hufflespin', '#EDAE49', 'wind', 2),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Ravenflow', '#30638E', 'lightning', 3),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'Order of the Phenol', '#7A3B69', 'flame', 4);
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/test/seedTeams.test.ts`

Expected: PASS.

- [x] **Step 5: Run project verification**

Run: `npm run check`

Expected: tous les tests et la compilation réussissent.

- [x] **Step 6: Commit**

```bash
git add src/test/seedTeams.test.ts supabase/seed.sql docs/superpowers/plans/2026-09-09-team-identities.md
git commit -m "feat: update team identities"
```
