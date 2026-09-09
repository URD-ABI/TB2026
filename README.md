# Team Building 2026

Site événementiel en français comprenant un classement en temps réel, une cérémonie d’attribution prédéterminée, cinq défis, un quiz à six thèmes et une interface organisateur protégée.

## Développement local

Prérequis : Node.js 22, Docker et la CLI Supabase.

```powershell
npm ci
npx supabase start
npx supabase db reset
Copy-Item .env.example .env.local
npm run dev
```

Renseigner dans `.env.local` l’URL locale Supabase, la clé publique `anon` et `VITE_EVENT_SLUG=team-building-2026`. Les clés `service_role` et jetons utilisateurs ne doivent jamais être ajoutés au dépôt ni au navigateur.

## Compte organisateur

Créer un utilisateur e-mail/mot de passe dans Supabase Authentication, copier son UUID, puis exécuter dans l’éditeur SQL :

```sql
insert into public.admin_users (user_id) values ('UUID_UTILISATEUR');
```

L’interface de pilotage est disponible sur `/admin`. Elle permet de modifier les contenus, gérer scores et clés, préparer les affectations, piloter le quiz, exporter une sauvegarde et réinitialiser une répétition.

## Vérifications

```powershell
npm run test:run
npx supabase test db
npm run test:e2e
npm run build
```

La [checklist de répétition](docs/rehearsal-checklist.md) décrit le contrôle à effectuer sur les deux ordinateurs avant l’événement.

## Déploiement GitHub Pages

1. Créer un projet Supabase hébergé, lier la CLI avec `npx supabase link --project-ref ...`, puis appliquer les migrations avec `npx supabase db push`.
2. Charger si souhaité `supabase/seed.sql`, créer l’organisateur et l’ajouter à `admin_users`.
3. Dans le dépôt GitHub, créer les variables Actions `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les valeurs publiques du projet.
4. Dans **Settings → Pages**, choisir **GitHub Actions** comme source.
5. Pousser la branche `main` ou lancer manuellement le workflow **Deploy GitHub Pages**.

Le build adapte automatiquement le chemin de base au nom du dépôt et génère `404.html` afin que les routes directes telles que `/admin` ou `/quiz` soient restaurées par GitHub Pages.
