# CutGym

A gym, meals and body-weight app for running a cut, built on
[openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0) by Duarte Santos and contributors.

**What's different from openGym**

- **Runs on Supabase + Vercel, no server to keep alive.** openGym's Node API stores each profile as
  a JSON file. Here that document lives in Postgres (`public.og_state`) and is synced through one
  Supabase Edge Function (`supabase/functions/api`), which keeps openGym's revision checks and
  merge rules, so multi-device sync behaves the same.
- **Sign-in is Supabase Auth** (e-mail + password) instead of passkeys.
- **Eat tab** (from the Cut Plan app): daily calorie and protein targets, a food log, a 7-day meal
  plan of oven dinners and breakfasts, recipes, and one-tap "Log it" from the plan.
- **Your cut on Home**: calories left, protein, last weigh-in vs. goal, weekly trend with an
  estimate of when you hit the goal, a 7-day calorie chart and quick actions.
- **New look**: warm dark theme, Fraunces + Space Grotesk, moss and mango accents, floating tab bar.

Everything else is openGym: routines, guided workouts, rest timer, progression, muscle map,
1,300+ exercises, stats, PRs, body weight and measurements, programmes, challenges, imports from
Strong / Hevy / FitNotes, backups.

**Not available in this build** (they need openGym's server): the AI Coach, web push reminders,
uploading photos/videos of custom exercises, server integrations (webhooks, MCP), the admin
dashboard, passkeys, and the Zepp watch relay.

## Layout

| Path | What |
|---|---|
| `frontend/` | openGym's React app, with `src/lib/supabase.js`, `src/lib/nutrition.js`, `src/views/Eat.jsx`, `src/components/CutCard.jsx`, `src/cutgym.css` added |
| `supabase/functions/api/` | Edge Function: `/config`, `/me`, `/data`, `/data/rev`, `/account/delete` |
| `supabase/migrations/` | Tables and row-level security |
| `vercel.json` | Build + exercise media served from openGym's repo via jsDelivr |
| (removed) | openGym's Node server, Docker, Helm and Kubernetes files: see upstream DuarteSantos8/openGym |

## Deploy

1. Supabase: apply `supabase/migrations/*.sql`, deploy the function with
   `supabase functions deploy api --no-verify-jwt`.
2. In Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL (used in
   confirmation and reset e-mails). Or turn off **Confirm email** for a personal instance.
3. Vercel: import this repo. Optional env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (the defaults point at the CutGym project).

## Licence

AGPL-3.0, like openGym (see `LICENSE`). If you run a modified version for other people, offer them
its source. Exercise images and animations come from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) and carry their
own terms (`catalogue/media/NOTICE.md`); this repo does not include them.
