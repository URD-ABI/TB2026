# Fixed Ranking Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l’organisateur de définir le nombre de points correspondant à un réceptacle plein, avec 100 points par défaut.

**Architecture:** La capacité devient une propriété persistée de `EventConfig`, lue et mise à jour avec les autres paramètres de l’événement. Le classement transmet cette valeur à chaque cylindre, qui calcule son niveau indépendamment des scores adverses et le borne entre 0 et 100 %.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Supabase/PostgreSQL, pgTAP, Vite

---

### Task 1: Étendre le contrat d’événement et le dépôt Supabase

**Files:**
- Modify: `src/repositories/SupabaseEventRepository.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/test/fixtures.ts`
- Modify: `src/repositories/SupabaseEventRepository.ts`

- [ ] **Step 1: Écrire les assertions de lecture et d’écriture qui échouent**

Dans `src/repositories/SupabaseEventRepository.test.ts`, ajouter `score_capacity: 100` à `eventRow`, attendre `scoreCapacity: 100` dans le résultat de `mapEventRow`, puis compléter le test de `updateEvent` :

```ts
const eventRow = {
  id: "event-1", slug: "tournoi-des-arcanes", title: "Le Tournoi des Arcanes",
  subtitle: "Team Building 2026", background_path: "event-1/background.webp",
  quiz_enabled: true, score_capacity: 100,
};
```

```ts
expect(mapEventRow(eventRow)).toEqual({
  id: "event-1", slug: "tournoi-des-arcanes", title: "Le Tournoi des Arcanes",
  subtitle: "Team Building 2026", backgroundUrl: "event-1/background.webp",
  quizEnabled: true, scoreCapacity: 100,
});
```

```ts
expect(rpc).toHaveBeenCalledWith("update_event", expect.objectContaining({
  p_event_id: "event-1",
  p_background_path: "event-1/background.webp",
  p_score_capacity: 100,
}));
```

- [ ] **Step 2: Exécuter le test et constater l’absence du nouveau mapping**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/repositories/SupabaseEventRepository.test.ts
```

Expected: FAIL car `mapEventRow` ne renvoie pas `scoreCapacity` et `updateEvent` n’envoie pas `p_score_capacity`.

- [ ] **Step 3: Ajouter la propriété au type et à la fixture**

Dans `EventConfig` de `src/domain/types.ts`, ajouter :

```ts
scoreCapacity: number;
```

Dans `makeEvent` de `src/test/fixtures.ts`, ajouter la valeur par défaut :

```ts
scoreCapacity: 100,
```

- [ ] **Step 4: Mapper et transmettre la capacité**

Dans `mapEventRow` de `src/repositories/SupabaseEventRepository.ts`, ajouter :

```ts
scoreCapacity: row.score_capacity as number,
```

Dans l’objet RPC de `updateEvent`, ajouter :

```ts
p_score_capacity: event.scoreCapacity,
```

- [ ] **Step 5: Exécuter les tests du dépôt**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/repositories/SupabaseEventRepository.test.ts src/repositories/MemoryEventRepository.test.ts
```

Expected: PASS. Le dépôt en mémoire ne nécessite aucun code supplémentaire, car `updateEvent` clone déjà l’objet complet.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/types.ts src/test/fixtures.ts src/repositories/SupabaseEventRepository.ts src/repositories/SupabaseEventRepository.test.ts
git commit -m "feat: add ranking capacity to event config"
```

### Task 2: Persister la capacité dans Supabase

**Files:**
- Create: `supabase/migrations/202609030012_ranking_capacity.sql`
- Modify: `supabase/tests/security.sql`

- [ ] **Step 1: Étendre les tests pgTAP avant la migration**

Dans `supabase/tests/security.sql` :

1. passer le plan de `316` à `324` ;
2. ajouter les contrats de colonne :

```sql
select has_column('public', 'events', 'score_capacity', 'events has score capacity');
select col_type_is('public', 'events', 'score_capacity', 'integer', 'event score capacity is integer');
select col_not_null('public', 'events', 'score_capacity', 'event score capacity is required');
select col_default_is('public', 'events', 'score_capacity', '100', 'event score capacity defaults to 100');
```

3. remplacer le test de signature de `update_event` par :

```sql
select has_function('public', 'update_event', array['uuid', 'text', 'text', 'text', 'text', 'boolean', 'integer']::text[], 'transactional event update has the required signature');
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'update_event' and oidvectortypes(p.proargtypes) = 'uuid, text, text, text, text, boolean, integer'), array['p_event_id', 'p_slug', 'p_title', 'p_subtitle', 'p_background_path', 'p_quiz_enabled', 'p_score_capacity']::text[], 'update_event exposes the expected parameter names');
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'update_event' and oidvectortypes(p.proargtypes) = 'uuid, text, text, text, text, boolean, integer'), true, 'update_event is security definer');
```

4. ajouter `100` à l’appel anonyme existant, utiliser `125` dans l’appel administrateur existant, puis ajouter :

```sql
select is((select score_capacity from public.events where id = '11111111-1111-1111-1111-111111111111'), 125, 'event update persists score capacity');
select throws_ok($$select public.update_event('11111111-1111-1111-1111-111111111111', 'security-test', 'Invalid capacity', 'Subtitle', null, false, 0)$$, 'P0001', 'score_capacity_must_be_positive', 'event update rejects a non-positive score capacity');
```

- [ ] **Step 2: Exécuter les tests de base et vérifier qu’ils échouent sur la colonne absente**

Run:

```powershell
& '.\node_modules\.bin\supabase.cmd' test db
```

Expected: FAIL sur le contrat `score_capacity` ou la nouvelle signature de `update_event`.

- [ ] **Step 3: Créer la migration de capacité**

Créer `supabase/migrations/202609030012_ranking_capacity.sql` avec :

```sql
alter table public.events
  add column score_capacity integer not null default 100
  constraint events_score_capacity_positive check (score_capacity > 0);

drop function if exists public.update_event(uuid, text, text, text, text, boolean);

create function public.update_event(
  p_event_id uuid,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_background_path text,
  p_quiz_enabled boolean,
  p_score_capacity integer
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_background_path text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if nullif(btrim(p_slug), '') is null or nullif(btrim(p_title), '') is null then
    raise exception 'event_fields_required' using errcode = 'P0001';
  end if;
  if p_score_capacity is null or p_score_capacity <= 0 then
    raise exception 'score_capacity_must_be_positive' using errcode = 'P0001';
  end if;
  if p_background_path is not null
    and (p_background_path not like p_event_id::text || '/%'
      or p_background_path like '%/../%'
      or p_background_path like '%/./%') then
    raise exception 'invalid_event_background_path' using errcode = 'P0001';
  end if;

  select background_path into v_old_background_path
  from public.events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  if v_old_background_path is not null
    and v_old_background_path <> coalesce(p_background_path, '')
    and v_old_background_path like p_event_id::text || '/%'
    and v_old_background_path not like '%/../%'
    and v_old_background_path not like '%/./%' then
    insert into public.media_cleanup_queue (event_id, path)
    values (p_event_id, v_old_background_path)
    on conflict do nothing;
  end if;

  if p_background_path is not null then
    delete from public.media_cleanup_queue
    where event_id = p_event_id and path = p_background_path;
  end if;

  update public.events
  set slug = btrim(p_slug),
      title = btrim(p_title),
      subtitle = btrim(p_subtitle),
      background_path = p_background_path,
      quiz_enabled = p_quiz_enabled,
      score_capacity = p_score_capacity
  where id = p_event_id;
end;
$$;

revoke all on function public.update_event(uuid, text, text, text, text, boolean, integer) from public, anon;
grant execute on function public.update_event(uuid, text, text, text, text, boolean, integer) to authenticated;
```

- [ ] **Step 4: Réinitialiser la base locale et exécuter les tests pgTAP**

Run:

```powershell
& '.\node_modules\.bin\supabase.cmd' db reset
& '.\node_modules\.bin\supabase.cmd' test db
```

Expected: la migration s’applique et les 324 assertions pgTAP passent.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/202609030012_ranking_capacity.sql supabase/tests/security.sql
git commit -m "feat: persist ranking capacity in Supabase"
```

### Task 3: Ajouter le réglage dans l’interface Événement

**Files:**
- Modify: `src/features/admin/EventEditor.test.tsx`
- Modify: `src/features/admin/EventEditor.tsx`

- [ ] **Step 1: Écrire les tests du champ et de sa validation**

Ajouter à `EventEditor.test.tsx` :

```tsx
it("enregistre une capacité entière strictement positive", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<EventEditor event={makeEvent({ scoreCapacity: 100 })} onSave={onSave} uploadBackground={vi.fn()} />);

  const capacity = screen.getByRole("spinbutton", { name: /capacité d’un réceptacle/i });
  expect(capacity).toHaveValue(100);
  await user.clear(capacity);
  await user.type(capacity, "250");
  await user.click(screen.getByRole("button", { name: /enregistrer l’événement/i }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scoreCapacity: 250 }));
});

it.each(["", "0", "-1", "1.5"])("refuse la capacité invalide %s", async (value) => {
  const onSave = vi.fn();
  render(<EventEditor event={makeEvent()} onSave={onSave} uploadBackground={vi.fn()} />);

  const capacity = screen.getByRole("spinbutton", { name: /capacité d’un réceptacle/i });
  fireEvent.change(capacity, { target: { value } });
  fireEvent.submit(capacity.closest("form") as HTMLFormElement);

  expect(screen.getByRole("alert")).toHaveTextContent(/capacité.*nombre entier.*supérieur à zéro/i);
  expect(onSave).not.toHaveBeenCalled();
});
```

Ajouter `fireEvent` à l’import Testing Library du fichier.

- [ ] **Step 2: Exécuter le test et vérifier l’absence du champ**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/EventEditor.test.tsx
```

Expected: FAIL car aucun spinbutton « Capacité d’un réceptacle » n’existe.

- [ ] **Step 3: Ajouter la validation et le champ**

Dans `submit`, avant `setValidationError(null)`, ajouter :

```tsx
if (!Number.isInteger(draft.scoreCapacity) || draft.scoreCapacity <= 0) {
  setValidationError("La capacité doit être un nombre entier supérieur à zéro.");
  return;
}
```

Après le champ Sous-titre, ajouter :

```tsx
<label>
  Capacité d’un réceptacle (points)
  <input
    type="number"
    min={1}
    step={1}
    value={Number.isFinite(draft.scoreCapacity) ? draft.scoreCapacity : ""}
    onChange={(event) => setDraft({
      ...draft,
      scoreCapacity: event.target.value === "" ? Number.NaN : Number(event.target.value),
    })}
  />
</label>
```

- [ ] **Step 4: Exécuter les tests de l’éditeur**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/admin/EventEditor.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/admin/EventEditor.tsx src/features/admin/EventEditor.test.tsx
git commit -m "feat: edit ranking capacity in event settings"
```

### Task 4: Calculer les niveaux par rapport à la capacité fixe

**Files:**
- Modify: `src/features/ranking/RankingPage.test.tsx`
- Modify: `src/features/ranking/RankingPage.tsx`
- Modify: `src/features/ranking/TeamCylinder.tsx`

- [ ] **Step 1: Adapter le helper de test à une capacité explicite**

Importer `makeEvent` puis remplacer `renderRanking` par :

```tsx
function renderRanking(teams: Team[], scoreCapacity = 100) {
  const repository = new MemoryEventRepository(makeEventSnapshot({
    event: makeEvent({ scoreCapacity }),
    teams,
  }), {});
  const view = render(
    <AppProviders repository={repository} eventSlug={EVENT_SLUG}>
      <RankingPage />
    </AppProviders>,
  );

  return { ...view, repository };
}
```

Renommer le test « borne le sable magique… » pour préciser la capacité fixe, garder ses valeurs avec une capacité de 100, puis appeler le second test de remplissage avec `renderRanking(..., 1000)`.

Ajouter :

```tsx
it("utilise la capacité de l’événement indépendamment du meilleur score", async () => {
  renderRanking(fiveTeams([
    { points: 150 },
    { points: 100 },
    { points: 50 },
    { points: 1 },
    { points: 0 },
  ]), 100);

  const cylinders = await screen.findAllByTestId("team-cylinder");
  expect(cylinders.map((cylinder) => cylinder.style.getPropertyValue("--fill"))).toEqual([
    "100%", "100%", "50%", "4%", "0%",
  ]);
  expect(within(cylinders[0]).getByText("150 points")).toBeInTheDocument();
  expect(within(cylinders[2]).getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    "50 % de la capacité de 100 points",
  );
});
```

- [ ] **Step 2: Exécuter le test et vérifier qu’il échoue sur l’échelle dynamique**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/ranking/RankingPage.test.tsx
```

Expected: FAIL car le meilleur score reçoit encore 100 % et le texte accessible mentionne « meilleur score ».

- [ ] **Step 3: Transmettre la capacité de l’événement**

Dans `RankingPage.tsx`, supprimer le calcul `maximum` et rendre :

```tsx
<TeamCylinder
  key={entry.team.id}
  entry={entry}
  capacity={snapshot.event.scoreCapacity}
/>
```

- [ ] **Step 4: Calculer et décrire le remplissage fixe**

Dans `TeamCylinder.tsx`, remplacer `maximum` par `capacity` dans le type et la fonction :

```tsx
type TeamCylinderProps = {
  entry: RankedTeam;
  capacity: number;
};

export function TeamCylinder({ entry, capacity }: TeamCylinderProps) {
  const { team, rank, requiresTieBreak } = entry;
  const ratio = capacity > 0 ? team.points / capacity : 0;
  const fill = team.points <= 0
    ? 0
    : Math.max(4, Math.min(100, Math.round(ratio * 100)));
```

Remplacer le texte accessible par :

```tsx
aria-valuetext={`${fill} % de la capacité de ${capacity} points`}
```

- [ ] **Step 5: Exécuter les tests du classement**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run src/features/ranking/RankingPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/ranking/RankingPage.tsx src/features/ranking/TeamCylinder.tsx src/features/ranking/RankingPage.test.tsx
git commit -m "feat: scale ranking cylinders to fixed capacity"
```

### Task 5: Vérification globale et visuelle

**Files:**
- No file changes expected.

- [ ] **Step 1: Exécuter tous les tests applicatifs**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' --run
```

Expected: tous les fichiers et tests Vitest passent.

- [ ] **Step 2: Vérifier TypeScript et la construction de production**

Run:

```powershell
& '.\node_modules\.bin\tsc.cmd' -b
& 'C:\Users\matthieu.mention\.tools\node-v20.20.1-win-x64\npm.cmd' run build
```

Expected: aucune erreur TypeScript et construction Vite réussie.

- [ ] **Step 3: Vérifier le parcours local**

Dans Administration → Événement, enregistrer une capacité de 200 points. Sur le classement, vérifier qu’une équipe à 100 points remplit la moitié du réceptacle et qu’une équipe à 250 points affiche 250 points avec un réceptacle plein. Revenir ensuite à 100 points pour conserver la valeur par défaut attendue.

- [ ] **Step 4: Vérifier l’état Git**

Run:

```powershell
git status --short
git log -5 --oneline
```

Expected: aucun fichier applicatif non validé et les commits des quatre tâches apparaissent dans l’historique.
