# Supabase setup

This project keeps schema changes in `supabase/migrations/` and only contains public, deterministic demonstration data in `supabase/seed.sql`. It never seeds an administrator identity.

## Local development

Install the project dependencies, start the local Supabase stack, then apply migrations and the seed:

```powershell
npm install
npx supabase start
npx supabase db reset
npx supabase test db
```

`supabase start` prints the local Project URL and publishable (anon) key. Create local environment settings from the example file, then copy those two public values into it:

```powershell
Copy-Item .env.example .env
```

Set `VITE_SUPABASE_URL` to the Project URL and `VITE_SUPABASE_ANON_KEY` to the publishable anon key. Do not commit `.env`; it must not contain a service-role key or any other secret.

Open the local Studio URL printed by `supabase start`, create an email/password user in **Authentication → Users**, and copy its UUID. In the SQL editor, insert that UUID as the administrator:

```sql
insert into public.admin_users (user_id)
values ('USER_UUID_FROM_AUTH_USERS');
```

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

## Hosted project

Authenticate the CLI, link this checkout to the hosted project, and push the versioned migrations:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

To load the optional deterministic demonstration data into a hosted project, run the contents of `supabase/seed.sql` once in the project SQL editor after the migration push. Then create an email/password user in **Authentication → Users** and insert its UUID into `public.admin_users` using the SQL above.

In **Project Settings → API**, copy the hosted Project URL and publishable anon key into `.env`, using the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` names. The anon key is intended for browser use; never put `service_role` credentials in browser environment variables or source control.

## Data access model

Anyone can read event presentation data: events, teams, participants, challenges, quiz categories/questions, and quiz session state. The `event-media` storage bucket is likewise publicly readable so these assets can be displayed in the event UI.

Assignments, quiz answers, score-event history, and administrator membership are protected by RLS and are not client-readable. Authenticated users are not administrators by default. Only UUIDs inserted into `admin_users` may perform table mutations, write `event-media` objects, or call `apply_score_event`. `reveal_next_participant` is deliberately callable by the public client, but returns only the next participant/team reveal and never exposes the hidden assignments table.
