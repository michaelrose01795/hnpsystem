begin;

create table if not exists public.technician_capacity_overrides (
  override_id bigint generated always as identity primary key,
  user_id integer not null references public.users(user_id) on delete cascade,
  capacity_date date not null,
  available_hours numeric(5,2) not null check (available_hours >= 0 and available_hours <= 24),
  created_by integer references public.users(user_id) on delete set null,
  updated_by integer references public.users(user_id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint technician_capacity_overrides_user_date_key unique (user_id, capacity_date)
);

create index if not exists technician_capacity_overrides_capacity_date_idx
  on public.technician_capacity_overrides (capacity_date);

comment on table public.technician_capacity_overrides is
  'Workshop manager overrides for a technician available-hours value on a specific date. Missing rows follow HR contracted hours and approved leave.';

commit;

notify pgrst, 'reload schema';
