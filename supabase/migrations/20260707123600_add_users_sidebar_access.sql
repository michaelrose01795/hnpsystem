alter table public.users
  add column if not exists sidebar_access jsonb;
