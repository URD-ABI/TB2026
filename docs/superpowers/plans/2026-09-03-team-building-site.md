# Team Building 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire et publier sur GitHub Pages le site Team Building 2026, avec quatre pages publiques et une interface organisateur Supabase synchronisée en temps réel.

**Architecture:** Une application React/TypeScript construite par Vite sert l’écran public et la route `/admin`. Les lectures et écritures passent par un dépôt typé ; Supabase fournit PostgreSQL, Auth, Storage et Realtime, tandis qu’un dépôt mémoire injecté dans les tests rend les parcours déterministes. Les opérations de score et de quiz sensibles sont exécutées par des fonctions SQL atomiques.

**Tech Stack:** React, TypeScript, Vite, React Router, Supabase JS, Zod, Vitest, Testing Library, Playwright, PostgreSQL/Supabase, GitHub Actions et GitHub Pages.

---

## Structure cible

```text
.
├── .env.example                         # Variables publiques Supabase et slug d’événement
├── .github/workflows/deploy-pages.yml  # Construction et publication GitHub Pages
├── docs/
│   ├── setup-supabase.md                # Mise en service du projet Supabase
│   └── rehearsal-checklist.md           # Répétition générale
├── e2e/event-flow.spec.ts               # Parcours projecteur + organisateur
├── public/
│   └── favicon.svg                      # Emblème générique du tournoi
├── scripts/copy-404.mjs                 # Repli des routes profondes GitHub Pages
├── src/
│   ├── app/App.tsx                      # Routage public et administrateur
│   ├── app/AppProviders.tsx             # Dépôt, session et notifications
│   ├── app/routes.ts                    # Définition des routes et navigation
│   ├── components/                      # Composants visuels partagés
│   ├── domain/                          # Types et règles métier pures
│   ├── features/admin/                  # Connexion et cinq espaces d’administration
│   ├── features/assignment/             # Faux tirage prédéfini
│   ├── features/challenges/             # Mosaïque de défis
│   ├── features/quiz/                   # Sélection, questions et états du quiz
│   ├── features/ranking/                # Cylindres, clés et rangs
│   ├── lib/                             # Configuration et utilitaires
│   ├── repositories/                    # Contrat, Supabase et dépôt mémoire
│   ├── styles/                          # Thème, composants et responsive
│   └── test/                            # Outils et données de test
├── supabase/
│   ├── migrations/                      # Schéma, RLS, Storage et fonctions atomiques
│   └── seed.sql                         # Événement de démonstration
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Task 1: Initialiser l’application et la chaîne de tests

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Installer les dépendances et générer le verrouillage**

Run:

```powershell
npm init -y
npm install react react-dom react-router-dom @supabase/supabase-js zod clsx
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/node eslint playwright @playwright/test
```

Expected: `package-lock.json` est créé et `npm ls --depth=0` se termine sans dépendance invalide.

- [ ] **Step 2: Écrire le test de démarrage qui échoue**

```tsx
// src/app/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("affiche le titre initial du tournoi", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /tournoi des arcanes/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Exécuter le test et constater l’échec**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: FAIL car `src/app/App.tsx` n’existe pas.

- [ ] **Step 4: Ajouter la configuration et le composant minimal**

```powershell
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="tsc -b && vite build && node scripts/copy-404.mjs"
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:run="vitest run"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.check="npm run test:run && npm run build"
```

```ts
// vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? ""}/` : "/",
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

```tsx
// src/app/App.tsx
export function App() {
  return <main><h1>Le Tournoi des Arcanes</h1><p>Team Building 2026</p></main>;
}
```

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Vérifier le démarrage**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json index.html tsconfig.json vite.config.ts src
git commit -m "chore: scaffold team building app"
```

## Task 2: Définir le domaine, le tri et le dépôt mémoire

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/ranking.ts`
- Create: `src/repositories/EventRepository.ts`
- Create: `src/repositories/MemoryEventRepository.ts`
- Create: `src/test/fixtures.ts`
- Test: `src/domain/ranking.test.ts`
- Test: `src/repositories/MemoryEventRepository.test.ts`

- [ ] **Step 1: Écrire les tests de tri qui échouent**

```ts
// src/domain/ranking.test.ts
import { describe, expect, it } from "vitest";
import { rankTeams } from "./ranking";
import { makeTeam } from "../test/fixtures";

describe("rankTeams", () => {
  it("trie par points puis clés sans déplacer la position d’affichage", () => {
    const teams = [
      makeTeam({ id: "a", displayOrder: 0, points: 100, keys: 2 }),
      makeTeam({ id: "b", displayOrder: 1, points: 100, keys: 3 }),
      makeTeam({ id: "c", displayOrder: 2, points: 80, keys: 8 }),
    ];
    expect(rankTeams(teams).map(({ team, rank }) => [team.id, rank])).toEqual([
      ["a", 2], ["b", 1], ["c", 3],
    ]);
  });

  it("exige un départage si points et clés sont identiques", () => {
    const teams = [makeTeam({ id: "a" }), makeTeam({ id: "b" })];
    expect(rankTeams(teams).every((entry) => entry.requiresTieBreak)).toBe(true);
  });
});
```

- [ ] **Step 2: Exécuter le test et constater l’échec**

Run: `npm test -- --run src/domain/ranking.test.ts`

Expected: FAIL car `rankTeams` et les types n’existent pas.

- [ ] **Step 3: Définir les types partagés et le tri**

```ts
// src/domain/types.ts
export type Id = string;
export type Team = { id: Id; eventId: Id; name: string; color: string; emblem: string; displayOrder: number; points: number; keys: number; tieBreakPriority: number | null };
export type Participant = { id: Id; eventId: Id; name: string; photoUrl: string | null; revealedTeamId: Id | null; revealOrder: number; revealedAt: string | null };
export type AdminParticipant = Participant & { assignedTeamId: Id };
export type Challenge = { id: Id; eventId: Id; title: string; kind: string; description: string; imageUrl: string | null; displayOrder: number };
export type QuizCategory = { id: Id; eventId: Id; title: string; imageUrl: string | null; displayOrder: number; status: "available" | "played" };
export type QuizQuestion = { id: Id; categoryId: Id; prompt: string; points: number; displayOrder: number };
export type AdminQuizQuestion = QuizQuestion & { answer: string };
export type EventConfig = { id: Id; slug: string; title: string; subtitle: string; backgroundUrl: string | null; quizEnabled: boolean };
export type RankedTeam = { team: Team; rank: number; requiresTieBreak: boolean };
```

```ts
// src/domain/ranking.ts
import type { RankedTeam, Team } from "./types";

export function compareTeams(a: Team, b: Team): number {
  return b.points - a.points || b.keys - a.keys ||
    (a.tieBreakPriority ?? Number.MAX_SAFE_INTEGER) - (b.tieBreakPriority ?? Number.MAX_SAFE_INTEGER);
}

export function rankTeams(teams: Team[]): RankedTeam[] {
  const sorted = [...teams].sort(compareTeams);
  const unresolved = new Set<string>();
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.points === current.points && previous.keys === current.keys && previous.tieBreakPriority === null && current.tieBreakPriority === null) {
      unresolved.add(previous.id); unresolved.add(current.id);
    }
  }
  const ranks = new Map(sorted.map((team, index) => [team.id, index + 1]));
  return [...teams].sort((a, b) => a.displayOrder - b.displayOrder).map((team) => ({ team, rank: ranks.get(team.id)!, requiresTieBreak: unresolved.has(team.id) }));
}
```

- [ ] **Step 4: Définir le contrat de dépôt**

```ts
// src/repositories/EventRepository.ts
import type { Challenge, EventConfig, Participant, QuizCategory, QuizQuestion, Team } from "../domain/types";

export type EventSnapshot = { event: EventConfig; teams: Team[]; participants: Participant[]; challenges: Challenge[]; categories: QuizCategory[]; questions: QuizQuestion[] };
export type Unsubscribe = () => void;

export interface EventRepository {
  getSnapshot(slug: string): Promise<EventSnapshot>;
  subscribe(slug: string, listener: (snapshot: EventSnapshot) => void): Unsubscribe;
  updateEvent(event: EventConfig): Promise<void>;
  updateTeam(team: Team): Promise<void>;
  revealNextParticipant(eventId: string): Promise<{ participantId: string; teamId: string }>;
  applyScore(input: { eventId: string; teamId: string; points: number; keys: number; source: string; idempotencyKey: string }): Promise<void>;
}
```

- [ ] **Step 5: Implémenter le dépôt mémoire et ses tests**

```ts
// src/repositories/MemoryEventRepository.ts
import type { EventRepository, EventSnapshot, Unsubscribe } from "./EventRepository";
import type { EventConfig, Team } from "../domain/types";

export class MemoryEventRepository implements EventRepository {
  private listeners = new Set<(snapshot: EventSnapshot) => void>();
  constructor(private snapshot: EventSnapshot, private assignments: Record<string, string>) {}
  async getSnapshot() { return structuredClone(this.snapshot); }
  subscribe(_slug: string, listener: (snapshot: EventSnapshot) => void): Unsubscribe { this.listeners.add(listener); listener(structuredClone(this.snapshot)); return () => this.listeners.delete(listener); }
  async updateEvent(event: EventConfig) { this.snapshot.event = structuredClone(event); this.emit(); }
  async updateTeam(team: Team) { this.snapshot.teams = this.snapshot.teams.map((item) => item.id === team.id ? structuredClone(team) : item); this.emit(); }
  async revealNextParticipant(eventId: string) { const participant = [...this.snapshot.participants].filter((item) => item.eventId === eventId && !item.revealedAt).sort((a, b) => a.revealOrder - b.revealOrder)[0]; if (!participant) throw new Error("no_participant"); const teamId = this.assignments[participant.id]; this.snapshot.participants = this.snapshot.participants.map((item) => item.id === participant.id ? { ...item, revealedTeamId: teamId, revealedAt: new Date().toISOString() } : item); this.emit(); return { participantId: participant.id, teamId }; }
  async applyScore(input: { teamId: string; points: number; keys: number }) { this.snapshot.teams = this.snapshot.teams.map((team) => team.id === input.teamId ? { ...team, points: team.points + input.points, keys: team.keys + input.keys, tieBreakPriority: null } : team); this.emit(); }
  private emit() { const value = structuredClone(this.snapshot); this.listeners.forEach((listener) => listener(value)); }
}
```

Run: `npm test -- --run src/domain/ranking.test.ts src/repositories/MemoryEventRepository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/domain src/repositories src/test
git commit -m "feat: add event domain and repository contract"
```

## Task 3: Créer le schéma Supabase sécurisé

**Files:**
- Create: `supabase/migrations/202609030001_schema.sql`
- Create: `supabase/migrations/202609030002_security.sql`
- Create: `supabase/migrations/202609030003_score_functions.sql`
- Create: `supabase/seed.sql`
- Create: `docs/setup-supabase.md`
- Test: `supabase/tests/security.sql`

- [ ] **Step 1: Écrire le test SQL des invariants**

```sql
-- supabase/tests/security.sql
begin;
select plan(5);
select has_table('public', 'events', 'events exists');
select has_table('public', 'teams', 'teams exists');
select has_table('public', 'participants', 'participants exists');
select has_function('public', 'apply_score_event', array['uuid','uuid','integer','integer','text','uuid'], 'atomic scoring exists');
select policies_are('public', 'teams', array['public_read_teams','admin_all_teams'], 'team policies are explicit');
select * from finish();
rollback;
```

- [ ] **Step 2: Créer les tables avec contraintes de cardinalité**

```sql
-- extrait complet des invariants dans 202609030001_schema.sql
create extension if not exists pgcrypto;
create table public.events (id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, subtitle text not null default 'Team Building 2026', background_path text, quiz_enabled boolean not null default false, created_at timestamptz not null default now());
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.teams (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, name text not null, color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'), emblem text not null, display_order smallint not null check (display_order between 0 and 4), points integer not null default 0, keys integer not null default 0 check (keys >= 0), tie_break_priority smallint, unique(event_id, display_order));
create table public.score_events (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, team_id uuid not null references public.teams on delete cascade, points_delta integer not null default 0, keys_delta integer not null default 0, source text not null, idempotency_key uuid unique not null, reversed_at timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id));
create table public.participants (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, name text not null, photo_path text, revealed_team_id uuid references public.teams on delete restrict, reveal_order integer not null check (reveal_order >= 0), revealed_at timestamptz, unique(event_id, reveal_order));
create table public.participant_assignments (participant_id uuid primary key references public.participants on delete cascade, team_id uuid not null references public.teams on delete restrict);
create table public.challenges (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, title text not null, kind text not null, description text not null, image_path text, display_order smallint not null check (display_order between 0 and 4), unique(event_id, display_order));
create table public.quiz_categories (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade, title text not null, image_path text, display_order smallint not null check (display_order between 0 and 5), status text not null default 'available' check (status in ('available','played')), unique(event_id, display_order));
create table public.quiz_questions (id uuid primary key default gen_random_uuid(), category_id uuid not null references public.quiz_categories on delete cascade, prompt text not null, points integer not null check (points > 0), display_order integer not null check (display_order >= 0), unique(category_id, display_order));
create table public.quiz_question_answers (question_id uuid primary key references public.quiz_questions on delete cascade, answer text not null);
create table public.quiz_sessions (id uuid primary key default gen_random_uuid(), event_id uuid unique not null references public.events on delete cascade, team_order uuid[] not null default '{}', current_team_index integer not null default 0, active_category_id uuid references public.quiz_categories, active_question_index integer not null default 0, answer_visible boolean not null default false, revealed_answer text, started_at timestamptz);
create table public.quiz_answers (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.quiz_sessions on delete cascade, question_id uuid not null references public.quiz_questions on delete cascade, team_id uuid not null references public.teams on delete cascade, correct boolean not null, score_event_id uuid references public.score_events, unique(session_id, question_id));
```

- [ ] **Step 3: Ajouter RLS, Storage et droits administrateur**

```sql
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.participant_assignments enable row level security;
alter table public.challenges enable row level security;
alter table public.quiz_categories enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_answers enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.score_events enable row level security;

create policy public_read_events on public.events for select using (true);
create policy public_read_teams on public.teams for select using (true);
create policy public_read_participants on public.participants for select using (true);
create policy public_read_challenges on public.challenges for select using (true);
create policy public_read_quiz_categories on public.quiz_categories for select using (true);
create policy public_read_quiz_questions on public.quiz_questions for select using (true);
create policy public_read_quiz_sessions on public.quiz_sessions for select using (true);

create policy admin_all_events on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_teams on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_participants on public.participants for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_participant_assignments on public.participant_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_challenges on public.challenges for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_quiz_categories on public.quiz_categories for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_quiz_questions on public.quiz_questions for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_quiz_question_answers on public.quiz_question_answers for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_quiz_sessions on public.quiz_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_quiz_answers on public.quiz_answers for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_score_events on public.score_events for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true) on conflict (id) do nothing;
create policy public_read_event_media on storage.objects for select using (bucket_id = 'event-media');
create policy admin_write_event_media on storage.objects for all using (bucket_id = 'event-media' and public.is_admin()) with check (bucket_id = 'event-media' and public.is_admin());
```

Les affectations prédéfinies et les réponses restent dans des tables sans politique publique. Le navigateur public ne reçoit que `revealed_team_id` après la révélation et `revealed_answer` après l’action de l’organisateur.

- [ ] **Step 4: Ajouter la fonction atomique de score**

```sql
create or replace function public.apply_score_event(p_event_id uuid, p_team_id uuid, p_points integer, p_keys integer, p_source text, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'admin_required'; end if;
  insert into score_events(event_id, team_id, points_delta, keys_delta, source, idempotency_key, created_by)
  values (p_event_id, p_team_id, p_points, p_keys, p_source, p_idempotency_key, auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from score_events where idempotency_key = p_idempotency_key;
    return v_id;
  end if;
  update teams set points = points + p_points, keys = keys + p_keys, tie_break_priority = null where id = p_team_id and event_id = p_event_id;
  if not found then raise exception 'team_not_found'; end if;
  return v_id;
end $$;
revoke all on function public.apply_score_event(uuid,uuid,integer,integer,text,uuid) from public;
grant execute on function public.apply_score_event(uuid,uuid,integer,integer,text,uuid) to authenticated;
```

La même migration crée `reveal_next_participant(p_event_id uuid)`. Cette fonction verrouille le premier participant non révélé (`for update skip locked`), copie son équipe depuis `participant_assignments` vers `participants.revealed_team_id`, renseigne `revealed_at`, puis retourne l’identifiant de l’équipe. Elle est exécutable par `anon` et `authenticated`, mais refuse l’appel si aucun participant n’est en attente. L’affectation reste donc absente des lectures publiques avant le clic.

- [ ] **Step 5: Appliquer localement et exécuter les tests SQL**

Run:

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
```

Expected: 5 tests SQL réussis et aucune erreur de migration.

- [ ] **Step 6: Commit**

```powershell
git add supabase docs/setup-supabase.md
git commit -m "feat: add secure Supabase event schema"
```

## Task 4: Brancher Supabase, le chargement et le temps réel

**Files:**
- Create: `.env.example`
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/repositories/SupabaseEventRepository.ts`
- Create: `src/app/AppProviders.tsx`
- Test: `src/lib/env.test.ts`
- Test: `src/app/AppProviders.test.tsx`

- [ ] **Step 1: Écrire les tests de configuration et de reconnexion**

```ts
// src/lib/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
describe("parseEnv", () => {
  it("refuse une configuration Supabase absente", () => {
    expect(() => parseEnv({})).toThrow(/VITE_SUPABASE_URL/);
  });
});
```

- [ ] **Step 2: Implémenter la validation des variables**

```ts
// src/lib/env.ts
import { z } from "zod";
const schema = z.object({ VITE_SUPABASE_URL: z.string().url(), VITE_SUPABASE_ANON_KEY: z.string().min(20), VITE_EVENT_SLUG: z.string().min(1).default("team-building-2026") });
export const parseEnv = (value: Record<string, unknown>) => schema.parse(value);
export const env = parseEnv(import.meta.env);
```

```dotenv
# .env.example
VITE_SUPABASE_URL=https://project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=replace-with-the-publishable-anon-key
VITE_EVENT_SLUG=team-building-2026
```

- [ ] **Step 3: Implémenter le dépôt Supabase**

`SupabaseEventRepository.getSnapshot` charge l’événement par `slug`, puis les six collections publiques liées en parallèle. `subscribe` écoute `postgres_changes` sur les tables contenant directement `event_id`, puis recharge un instantané cohérent avec un debounce de 50 ms. Les questions sont rechargées à partir des identifiants des six catégories. Les champs snake_case sont convertis vers les types camelCase de `src/domain/types.ts` dans des fonctions pures et testées.

```ts
const channel = client.channel(`event:${eventId}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` }, scheduleReload);
for (const table of ["teams", "participants", "challenges", "quiz_categories", "quiz_sessions"]) {
  channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` }, scheduleReload);
}
channel.subscribe((status) => connectionListener(status === "SUBSCRIBED" ? "online" : "reconnecting"));
return () => { void client.removeChannel(channel); };
```

- [ ] **Step 4: Fournir l’instantané et l’état réseau à React**

`AppProviders` expose `{ snapshot, status, repository }`, affiche une vue de chargement accessible, conserve le dernier instantané pendant une reconnexion et affiche un bandeau discret seulement lorsque `status === "reconnecting"`.

- [ ] **Step 5: Vérifier**

Run: `npm test -- --run src/lib/env.test.ts src/app/AppProviders.test.tsx`

Expected: PASS, dont un test prouvant que le dernier classement reste affiché pendant une reconnexion.

- [ ] **Step 6: Commit**

```powershell
git add .env.example src/lib src/repositories/SupabaseEventRepository.ts src/app/AppProviders.tsx
git commit -m "feat: connect event data and realtime updates"
```

## Task 5: Construire le thème et la navigation publique

**Files:**
- Create: `src/app/routes.ts`
- Create: `src/components/PublicLayout.tsx`
- Create: `src/components/ConnectionBanner.tsx`
- Create: `src/styles/theme.css`
- Create: `src/styles/global.css`
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`
- Test: `src/components/PublicLayout.test.tsx`

- [ ] **Step 1: Écrire le test de navigation conditionnelle**

```tsx
it("cache le quiz tant qu’il n’est pas activé", () => {
  renderPublicLayout({ quizEnabled: false });
  expect(screen.queryByRole("link", { name: /quiz/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implémenter le routeur avec basename**

```tsx
// src/app/App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { RankingPage } from "../features/ranking/RankingPage";
import { AssignmentPage } from "../features/assignment/AssignmentPage";
import { ChallengesPage } from "../features/challenges/ChallengesPage";
import { QuizPage } from "../features/quiz/QuizPage";
import { AdminApp } from "../features/admin/AdminApp";

export function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route element={<PublicLayout />}>
        <Route index element={<RankingPage />} />
        <Route path="attribution" element={<AssignmentPage />} />
        <Route path="defis" element={<ChallengesPage />} />
        <Route path="quiz/*" element={<QuizPage />} />
      </Route>
    </Routes>
  </BrowserRouter>;
}
```

- [ ] **Step 3: Implémenter le thème dynamique**

`PublicLayout` pose `--event-background` depuis l’URL Supabase validée, ajoute le voile sombre, le titre et le sous-titre, puis affiche les liens Classement, Attribution et Défis. Le lien Quiz est rendu seulement si `snapshot.event.quizEnabled` vaut `true`.

- [ ] **Step 4: Vérifier l’accessibilité**

Run: `npm test -- --run src/components/PublicLayout.test.tsx`

Expected: PASS pour l’affichage du titre, le masquage du quiz et la navigation clavier.

- [ ] **Step 5: Commit**

```powershell
git add src/app src/components src/styles src/main.tsx
git commit -m "feat: add magical public shell and navigation"
```

## Task 6: Construire le classement à cylindres

**Files:**
- Create: `src/features/ranking/RankingPage.tsx`
- Create: `src/features/ranking/TeamCylinder.tsx`
- Create: `src/features/ranking/ranking.css`
- Test: `src/features/ranking/RankingPage.test.tsx`

- [ ] **Step 1: Écrire les tests d’affichage**

```tsx
it("conserve l’ordre visuel et affiche les rangs calculés", () => {
  renderRanking([
    makeTeam({ id: "a", name: "Lynx", displayOrder: 0, points: 40 }),
    makeTeam({ id: "b", name: "Hiboux", displayOrder: 1, points: 90 }),
  ]);
  const cylinders = screen.getAllByTestId("team-cylinder");
  expect(cylinders[0]).toHaveTextContent("Lynx");
  expect(cylinders[0]).toHaveTextContent("2");
  expect(cylinders[1]).toHaveTextContent("Hiboux");
  expect(cylinders[1]).toHaveTextContent("1");
});
```

- [ ] **Step 2: Implémenter `TeamCylinder`**

```tsx
export function TeamCylinder({ entry, maximum }: { entry: RankedTeam; maximum: number }) {
  const fill = maximum === 0 ? 0 : Math.max(4, Math.round(entry.team.points / maximum * 100));
  return <article data-testid="team-cylinder" className={`team-cylinder rank-${entry.rank}`} style={{ "--team-color": entry.team.color, "--fill": `${fill}%` } as React.CSSProperties}>
    <div className="rank" aria-label={`Place ${entry.rank}`}>{entry.rank}</div>
    <div className="glass"><div className="grains" /><strong className="score">{entry.team.points}</strong></div>
    <h2>{entry.team.emblem} {entry.team.name}</h2>
    <p>{entry.team.keys} {entry.team.keys === 1 ? "clé" : "clés"}</p>
  </article>;
}
```

- [ ] **Step 3: Ajouter le rendu grains et la réduction des animations**

Le CSS utilise deux `radial-gradient` décalés pour les billes, une transition de hauteur, des halos or/argent/bronze sur `.rank-1`, `.rank-2`, `.rank-3`, et désactive les transitions sous `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 4: Vérifier**

Run: `npm test -- --run src/features/ranking/RankingPage.test.tsx`

Expected: PASS, ordre fixe, rangs corrects, points et clés visibles.

- [ ] **Step 5: Commit**

```powershell
git add src/features/ranking
git commit -m "feat: add live magical ranking cylinders"
```

## Task 7: Construire l’attribution prédéfinie

**Files:**
- Create: `src/domain/assignment.ts`
- Create: `src/features/assignment/AssignmentPage.tsx`
- Create: `src/features/assignment/TeamReel.tsx`
- Create: `src/features/assignment/assignment.css`
- Test: `src/domain/assignment.test.ts`
- Test: `src/features/assignment/AssignmentPage.test.tsx`

- [ ] **Step 1: Écrire les tests de sélection et d’unicité**

```ts
it("sélectionne le premier participant non révélé dans l’ordre", () => {
  expect(nextParticipant([revealedAtOrder2, unrevealedOrder3, unrevealedOrder1])?.revealOrder).toBe(1);
});
```

```tsx
it("termine sur l’équipe renvoyée par la révélation atomique et bloque un second clic", async () => {
  const user = userEvent.setup();
  renderAssignment({ participant: makeParticipant(), revealResult: "hiboux" });
  await user.click(screen.getByRole("button", { name: /lancer/i }));
  await vi.runAllTimersAsync();
  expect(screen.getByRole("heading", { name: /hiboux/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /lancer/i })).toBeDisabled();
});
```

- [ ] **Step 2: Implémenter la règle pure**

```ts
export const nextParticipant = (participants: Participant[]) => [...participants].filter((item) => !item.revealedAt).sort((a, b) => a.revealOrder - b.revealOrder)[0] ?? null;
```

- [ ] **Step 3: Implémenter l’animation contrôlée**

`TeamReel` commence à parcourir les cinq équipes, annonce « Pique-nique-douille, c’est toi l’andouille », puis appelle `reveal_next_participant`. Après confirmation, l’animation ralentit et termine explicitement sur l’identifiant d’équipe retourné par la fonction. Le bouton reste désactivé pendant toute l’opération ; en cas d’échec, la roue s’arrête sans révélation et propose de réessayer.

- [ ] **Step 4: Ajouter les cinq compositions**

Les photos révélées sont groupées par `teamId`. Une image manquante affiche les initiales. La photo nouvellement révélée reçoit une animation courte, supprimée si l’utilisateur préfère réduire les animations.

- [ ] **Step 5: Vérifier**

Run: `npm test -- --run src/domain/assignment.test.ts src/features/assignment/AssignmentPage.test.tsx`

Expected: PASS avec cinq emblèmes rendus, bonne équipe finale et double clic impossible.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/assignment.ts src/features/assignment
git commit -m "feat: add predetermined team reveal ceremony"
```

## Task 8: Construire la mosaïque des défis

**Files:**
- Create: `src/features/challenges/ChallengesPage.tsx`
- Create: `src/features/challenges/ChallengeTile.tsx`
- Create: `src/features/challenges/challenges.css`
- Test: `src/features/challenges/ChallengesPage.test.tsx`

- [ ] **Step 1: Écrire le test de cardinalité et d’ordre**

```tsx
it("rend les cinq défis ordonnés et met le premier en avant", () => {
  renderChallenges(fiveChallengesInReverseOrder);
  const tiles = screen.getAllByTestId("challenge-tile");
  expect(tiles).toHaveLength(5);
  expect(tiles[0]).toHaveClass("featured");
  expect(tiles[0]).toHaveTextContent("Défi 1");
});
```

- [ ] **Step 2: Implémenter les tuiles**

`ChallengesPage` trie par `displayOrder`. `ChallengeTile` utilise l’image comme fond, un voile en dégradé, le numéro sur deux chiffres, le type, le titre et la description. Le premier reçoit `featured`; une image absente utilise un dégradé avec l’emblème de l’événement.

- [ ] **Step 3: Ajouter le responsive**

La grille utilise trois colonnes sur projecteur, deux sous 850 px et une sous 560 px. Aucun texte ne doit déborder avec les longueurs maximales validées par Zod : titre 80 caractères, type 40, description 240.

- [ ] **Step 4: Vérifier et commit**

Run: `npm test -- --run src/features/challenges/ChallengesPage.test.tsx`

Expected: PASS.

```powershell
git add src/features/challenges
git commit -m "feat: add editable five-challenge mosaic"
```

## Task 9: Implémenter le moteur et la page du quiz

**Files:**
- Create: `src/domain/quiz.ts`
- Create: `src/features/quiz/QuizPage.tsx`
- Create: `src/features/quiz/CategoryGrid.tsx`
- Create: `src/features/quiz/QuestionStage.tsx`
- Create: `src/features/quiz/quiz.css`
- Create: `supabase/migrations/202609030004_quiz_functions.sql`
- Test: `src/domain/quiz.test.ts`
- Test: `src/features/quiz/QuizPage.test.tsx`

- [ ] **Step 1: Écrire les tests du tour figé**

```ts
it("fige l’ordre selon le classement au lancement", () => {
  const order = freezeQuizOrder([teamThird, teamFirst, teamSecond]);
  expect(order).toEqual([teamFirst.id, teamSecond.id, teamThird.id]);
});

it("refuse le lancement avec un départage non résolu", () => {
  expect(() => freezeQuizOrder([tiedA, tiedB])).toThrow(/départage/i);
});
```

- [ ] **Step 2: Implémenter les règles pures**

```ts
export function freezeQuizOrder(teams: Team[]): string[] {
  const ranked = rankTeams(teams);
  if (ranked.some((entry) => entry.requiresTieBreak)) throw new Error("Un départage est requis avant le quiz");
  return [...ranked].sort((a, b) => a.rank - b.rank).map((entry) => entry.team.id);
}
export const canChooseCategory = (category: QuizCategory, chosenTeamIds: string[], teamId: string) => category.status === "available" && !chosenTeamIds.includes(teamId);
```

- [ ] **Step 3: Ajouter les fonctions SQL atomiques**

La migration crée `start_quiz(event_id)`, `choose_quiz_category(session_id, team_id, category_id)`, `reveal_quiz_answer(session_id, question_id)` et `answer_quiz_question(session_id, question_id, correct, idempotency_key)`. Chaque fonction vérifie l’administrateur, l’équipe courante, l’unicité du thème et de la réponse. `reveal_quiz_answer` copie la réponse protégée dans `quiz_sessions.revealed_answer` et active `answer_visible`; la validation appelle la logique de score dans la même transaction puis efface la réponse révélée avant la question suivante.

- [ ] **Step 4: Construire les trois états visuels**

`QuizPage` rend successivement : grille de six thèmes avec bandeau « Au tour de l’équipe… », scène de question, puis réponse révélée. Les actions de révélation et validation n’apparaissent que dans l’interface organisateur ; le public reflète l’état Supabase.

- [ ] **Step 5: Vérifier et commit**

Run: `npm test -- --run src/domain/quiz.test.ts src/features/quiz/QuizPage.test.tsx`

Expected: PASS pour ordre figé, thème unique, réponse unique et barème fixe.

```powershell
git add src/domain/quiz.ts src/features/quiz supabase/migrations/202609030004_quiz_functions.sql
git commit -m "feat: add ranked turn-based quiz flow"
```

## Task 10: Ajouter l’authentification et le cadre administrateur

**Files:**
- Create: `src/features/admin/AdminApp.tsx`
- Create: `src/features/admin/LoginPage.tsx`
- Create: `src/features/admin/AdminLayout.tsx`
- Create: `src/features/admin/useAdminSession.ts`
- Create: `src/features/admin/admin.css`
- Test: `src/features/admin/AdminApp.test.tsx`

- [ ] **Step 1: Écrire le test de protection**

```tsx
it("affiche la connexion sans session et le tableau de bord avec une session admin", async () => {
  const { rerender } = render(<AdminApp auth={signedOutAuth} />);
  expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  rerender(<AdminApp auth={adminAuth} />);
  expect(await screen.findByRole("navigation", { name: /administration/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Implémenter la session**

`useAdminSession` appelle `supabase.auth.getSession()`, écoute `onAuthStateChange`, vérifie la présence de l’utilisateur dans `admin_users`, puis expose `loading`, `user`, `isAdmin`, `signIn(email,password)` et `signOut()`.

- [ ] **Step 3: Implémenter le formulaire accessible**

Le formulaire contient email, mot de passe, bouton de soumission et message d’erreur générique. Il désactive la soumission en cours et ne journalise jamais les identifiants.

- [ ] **Step 4: Construire les cinq sections**

`AdminLayout` rend une navigation Événement, Équipes et scores, Participants, Défis et Quiz, plus la déconnexion. Les routes enfants sont protégées et toute session non administratrice est immédiatement déconnectée.

- [ ] **Step 5: Vérifier et commit**

Run: `npm test -- --run src/features/admin/AdminApp.test.tsx`

Expected: PASS pour session absente, admin valide et compte non autorisé.

```powershell
git add src/features/admin
git commit -m "feat: protect organizer administration"
```

## Task 11: Construire les éditeurs Événement, Équipes et Participants

**Files:**
- Create: `src/features/admin/EventEditor.tsx`
- Create: `src/features/admin/TeamsEditor.tsx`
- Create: `src/features/admin/ScoreControls.tsx`
- Create: `src/features/admin/ParticipantsEditor.tsx`
- Create: `src/features/admin/useSaveState.ts`
- Create: `src/lib/images.ts`
- Test: `src/features/admin/EventEditor.test.tsx`
- Test: `src/features/admin/ScoreControls.test.tsx`
- Test: `src/lib/images.test.ts`

- [ ] **Step 1: Écrire les tests d’enregistrement**

```tsx
it("confirme un score uniquement après succès du dépôt", async () => {
  const deferred = createDeferred<void>();
  renderScoreControls({ applyScore: () => deferred.promise });
  await userEvent.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
  expect(screen.getByText(/enregistrement/i)).toBeInTheDocument();
  deferred.resolve();
  expect(await screen.findByText(/enregistré/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implémenter l’état d’enregistrement partagé**

```ts
export type SaveState = "idle" | "saving" | "saved" | "error";
export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");
  const run = async (action: () => Promise<void>) => { setState("saving"); try { await action(); setState("saved"); } catch { setState("error"); throw new Error("save_failed"); } };
  return { state, run };
}
```

- [ ] **Step 3: Construire Événement et import d’arrière-plan**

Valider titre 1–80 caractères, sous-titre 1–80 et image JPEG/PNG/WebP de 10 Mio maximum. `resizeImage(file, 1920, 1080, 0.84)` utilise canvas, conserve le ratio et envoie un WebP dans `event-media/{eventId}/background.webp`.

- [ ] **Step 4: Construire équipes, points, clés et départage**

Les cinq cartes éditent nom, couleur et emblème. `ScoreControls` propose des deltas explicites et une valeur libre validée ; chaque envoi crée `crypto.randomUUID()`. Si points et clés sont identiques, un panneau choisit l’ordre du départage. Toute modification de score efface la priorité via la fonction SQL.

- [ ] **Step 5: Construire les participants**

La liste permet ajout, modification, suppression, import de photo, équipe et ordre. Le déplacement réécrit des `reveal_order` contigus dans une fonction SQL. La réinitialisation efface seulement `revealed_at` après confirmation.

- [ ] **Step 6: Vérifier et commit**

Run: `npm test -- --run src/features/admin/EventEditor.test.tsx src/features/admin/ScoreControls.test.tsx src/lib/images.test.ts`

Expected: PASS, y compris erreur réseau, fichier trop volumineux et priorité effacée.

```powershell
git add src/features/admin src/lib/images.ts
git commit -m "feat: add event team and participant administration"
```

## Task 12: Construire les éditeurs Défis et Quiz

**Files:**
- Create: `src/features/admin/ChallengesEditor.tsx`
- Create: `src/features/admin/QuizEditor.tsx`
- Create: `src/features/admin/QuizControlPanel.tsx`
- Test: `src/features/admin/ChallengesEditor.test.tsx`
- Test: `src/features/admin/QuizControlPanel.test.tsx`

- [ ] **Step 1: Écrire les tests de limites**

```tsx
it("maintient exactement cinq défis et six thèmes", () => {
  render(<ChallengesEditor challenges={fiveChallenges} />);
  expect(screen.getAllByRole("group", { name: /défi/i })).toHaveLength(5);
  render(<QuizEditor categories={sixCategories} />);
  expect(screen.getAllByRole("group", { name: /thème/i })).toHaveLength(6);
});
```

- [ ] **Step 2: Implémenter l’éditeur de défis**

Chaque carte édite titre, type, description et montage. Les cinq positions peuvent être échangées sans création ni suppression. Les images sont traitées par `resizeImage` et stockées dans `event-media/{eventId}/challenges/{challengeId}.webp`.

- [ ] **Step 3: Implémenter l’éditeur de quiz**

Les six thèmes sont fixes en nombre mais réordonnables. Chaque thème gère une liste ordonnée de questions `{ prompt, answer, points }`, avec points entiers strictement positifs. La suppression d’une question déjà utilisée est refusée par contrainte SQL et expliquée dans l’interface.

- [ ] **Step 4: Implémenter le contrôle en direct**

`QuizControlPanel` active le quiz, vérifie les départages, démarre la session, affiche l’ordre figé, révèle la réponse, valide correcte/incorrecte et indique le prochain passage. Tous les boutons sont désactivés pendant l’appel atomique.

- [ ] **Step 5: Vérifier et commit**

Run: `npm test -- --run src/features/admin/ChallengesEditor.test.tsx src/features/admin/QuizControlPanel.test.tsx`

Expected: PASS pour cardinalités, barème, départage requis et double validation.

```powershell
git add src/features/admin/ChallengesEditor.tsx src/features/admin/QuizEditor.tsx src/features/admin/QuizControlPanel.tsx
git commit -m "feat: add challenge and quiz administration"
```

## Task 13: Ajouter historique, annulation, export et réinitialisation

**Files:**
- Create: `supabase/migrations/202609030005_rehearsal_functions.sql`
- Create: `src/features/admin/ScoreHistory.tsx`
- Create: `src/features/admin/BackupControls.tsx`
- Create: `src/domain/export.ts`
- Test: `src/domain/export.test.ts`
- Test: `src/features/admin/BackupControls.test.tsx`

- [ ] **Step 1: Écrire les tests de sauvegarde**

```ts
it("exporte une version datée sans données de connexion", () => {
  const exported = buildEventExport(snapshot, new Date("2026-12-18T10:00:00Z"));
  expect(exported.version).toBe(1);
  expect(exported.exportedAt).toBe("2026-12-18T10:00:00.000Z");
  expect(JSON.stringify(exported)).not.toMatch(/password|anon_key|access_token/i);
});
```

- [ ] **Step 2: Ajouter les fonctions atomiques d’annulation et de répétition**

`reverse_score_event(score_event_id)` inverse une seule fois le delta et marque `reversed_at`. `reset_rehearsal(event_id)` efface révélations, session, réponses, états joués, score_events et remet points, clés et départage à zéro, mais conserve toute la configuration et les médias.

- [ ] **Step 3: Ajouter la confirmation forte**

La réinitialisation exige de saisir exactement `REINITIALISER`. L’interface énumère les données de session supprimées et les données éditoriales conservées avant d’activer le bouton.

- [ ] **Step 4: Ajouter l’export JSON**

`buildEventExport` produit `{ version: 1, exportedAt, event, teams, participants, challenges, categories, questions }`. Les chemins médias sont inclus, jamais les jetons ou la session utilisateur. Le fichier est nommé `team-building-2026-YYYY-MM-DD.json`.

- [ ] **Step 5: Vérifier et commit**

Run: `npm test -- --run src/domain/export.test.ts src/features/admin/BackupControls.test.tsx`

Expected: PASS pour export, confirmation et annulation unique.

```powershell
git add supabase/migrations/202609030005_rehearsal_functions.sql src/domain/export.ts src/features/admin/ScoreHistory.tsx src/features/admin/BackupControls.tsx
git commit -m "feat: add score recovery and rehearsal controls"
```

## Task 14: Tester le parcours complet et l’affichage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/event-flow.spec.ts`
- Create: `e2e/fixtures/event.ts`
- Modify: `package.json`
- Create: `docs/rehearsal-checklist.md`

- [ ] **Step 1: Écrire le parcours E2E**

```ts
test("scores, attribution et quiz restent synchronisés", async ({ browser }) => {
  const display = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const admin = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await display.goto("/");
  await admin.goto("/admin");
  await signInAdmin(admin);
  await addPoints(admin, "Hiboux", 100);
  await expect(display.getByTestId("team-Hiboux")).toContainText("100");
  await revealNextParticipant(display);
  await expect(display.getByRole("heading", { name: /hiboux/i })).toBeVisible();
  await startQuiz(admin);
  await display.getByRole("link", { name: /quiz/i }).click();
  await expect(display.getByText(/au tour de l’équipe hiboux/i)).toBeVisible();
});
```

- [ ] **Step 2: Configurer les projets d’affichage**

Playwright exécute Chromium en `1920x1080`, `1366x768` et `820x1180`, démarre `npm run dev -- --host 127.0.0.1`, et utilise un projet Supabase local remis à zéro avant la suite.

- [ ] **Step 3: Exécuter toutes les vérifications**

Run:

```powershell
npm run test:run
npm run test:e2e
npm run build
```

Expected: tous les tests unitaires et E2E passent ; `dist/index.html` et `dist/404.html` existent.

- [ ] **Step 4: Effectuer la vérification visuelle ciblée**

Vérifier à 1920×1080 : les cinq cylindres tiennent sans défilement, les rangs ne chevauchent pas le verre, les grains restent visibles à 0 et au maximum, et la navigation est lisible depuis une distance de projection. Vérifier à 820×1180 : formulaires administrateur sans débordement horizontal et boutons tactiles d’au moins 44 px.

- [ ] **Step 5: Commit**

```powershell
git add e2e playwright.config.ts package.json docs/rehearsal-checklist.md
git commit -m "test: cover complete team building event flow"
```

## Task 15: Publier sur GitHub Pages

**Files:**
- Create: `scripts/copy-404.mjs`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `README.md`
- Modify: `vite.config.ts`
- Test: build GitHub Pages local

- [ ] **Step 1: Ajouter le repli des routes profondes**

```js
// scripts/copy-404.mjs
import { copyFile } from "node:fs/promises";
await copyFile(new URL("../dist/index.html", import.meta.url), new URL("../dist/404.html", import.meta.url));
```

- [ ] **Step 2: Ajouter le workflow Pages**

```yaml
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
          VITE_EVENT_SLUG: team-building-2026
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Vérifier la construction comme dans GitHub Actions**

Run: `$env:GITHUB_ACTIONS='true'; $env:GITHUB_REPOSITORY='owner/tb2026'; npm run build`

Expected: PASS ; les URLs d’assets commencent par `/tb2026/` et les fichiers `dist/index.html` et `dist/404.html` existent.

- [ ] **Step 4: Documenter la mise en service**

Le README décrit : création du projet Supabase, exécution des migrations, création du compte Auth, insertion de son UUID dans `admin_users`, variables GitHub Actions, activation de GitHub Pages via Actions, utilisation de `/admin`, sauvegarde et répétition générale.

- [ ] **Step 5: Lancer la vérification finale**

Run: `npm run check`

Expected: tests et build réussis sans erreur.

- [ ] **Step 6: Commit**

```powershell
git add scripts/copy-404.mjs .github/workflows/deploy-pages.yml README.md vite.config.ts
git commit -m "ci: publish team building site to GitHub Pages"
```

## Critères de fin

- Les quatre pages publiques respectent les maquettes validées.
- Le quiz est absent de la navigation tant qu’il n’est pas activé.
- Le classement garde les équipes en position fixe et trie points, clés, puis départage.
- L’interface `/admin` est protégée et couvre tous les contenus demandés.
- Les actions critiques sont atomiques, historisées et résistantes au double clic.
- La synchronisation fonctionne entre deux navigateurs et se remet d’une coupure.
- L’export et la réinitialisation de répétition sont vérifiés.
- Les tests unitaires, SQL et E2E passent.
- Le build GitHub Pages contient le repli `404.html` et est publié via Actions.
