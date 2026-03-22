create table if not exists public.user_personal_security (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null unique references public.users(user_id) on delete cascade,
  passcode_hash text not null,
  is_setup boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.user_personal_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  widget_type text not null,
  is_visible boolean not null default true,
  position_x integer not null default 1,
  position_y integer not null default 1,
  width integer not null default 4,
  height integer not null default 3,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists user_personal_widgets_user_id_idx
  on public.user_personal_widgets(user_id);

create table if not exists public.user_personal_widget_data (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  widget_type text not null,
  data_json jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  unique (user_id, widget_type)
);

create table if not exists public.user_personal_layout (
  user_id integer primary key references public.users(user_id) on delete cascade,
  layout_json jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null default 'General',
  amount numeric not null default 0,
  date date not null default current_date,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists personal_transactions_user_id_idx
  on public.personal_transactions(user_id);

create table if not exists public.personal_savings (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null unique references public.users(user_id) on delete cascade,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  monthly_contribution numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.personal_bills (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  due_day integer not null default 1,
  is_recurring boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists personal_bills_user_id_idx
  on public.personal_bills(user_id);

create table if not exists public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  type text not null check (type in ('house', 'holiday', 'custom')),
  target numeric not null default 0,
  current numeric not null default 0,
  deadline date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists personal_goals_user_id_idx
  on public.personal_goals(user_id);

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  content text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists personal_notes_user_id_idx
  on public.personal_notes(user_id);

create table if not exists public.personal_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(user_id) on delete cascade,
  file_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  created_at timestamp with time zone not null default now()
);

create index if not exists personal_attachments_user_id_idx
  on public.personal_attachments(user_id);
