begin;

alter table public.users
  add column if not exists sidebar_access jsonb;

comment on column public.users.sidebar_access is
  'Versioned employee sidebar group, item access, and item-order snapshot. NULL uses role-derived defaults.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_sidebar_access_is_object'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_sidebar_access_is_object
      check (
        sidebar_access is null
        or jsonb_typeof(sidebar_access) = 'object'
      );
  end if;
end
$$;

commit;

-- Make the new column available to PostgREST immediately after this migration.
notify pgrst, 'reload schema';
