create table public.og_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null,
  rev integer not null default 0,
  wid text,
  updated_at timestamptz not null default now()
);
alter table public.og_state enable row level security;
create policy og_state_select on public.og_state for select to authenticated using (user_id = (select auth.uid()));
create policy og_state_insert on public.og_state for insert to authenticated with check (user_id = (select auth.uid()));
create policy og_state_update on public.og_state for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_tag text not null default 'Snack',
  description text not null,
  kcal integer not null check (kcal >= 0 and kcal < 10000),
  protein_g numeric check (protein_g is null or (protein_g >= 0 and protein_g < 1000)),
  created_at timestamptz not null default now()
);
create index nutrition_logs_user_date on public.nutrition_logs (user_id, log_date desc);
alter table public.nutrition_logs enable row level security;
create policy nutrition_logs_own on public.nutrition_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.nutrition_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  target_kcal integer not null default 1200,
  target_protein integer not null default 120,
  goal_kg numeric,
  plan jsonb,
  updated_at timestamptz not null default now()
);
alter table public.nutrition_settings enable row level security;
create policy nutrition_settings_own on public.nutrition_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
