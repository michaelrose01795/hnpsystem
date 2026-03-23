-- Canonical persistence table for the Profile > Personal tab.
create table if not exists public.user_personal_state (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_personal_state_user_id_key unique (user_id)
);

create index if not exists idx_user_personal_state_user_id on public.user_personal_state(user_id);
