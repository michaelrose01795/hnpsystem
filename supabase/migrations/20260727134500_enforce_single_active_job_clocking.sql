begin;

do $$
begin
  if exists (
    select 1
    from public.job_clocking
    where clock_out is null
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce one active job clocking per user while duplicate open rows exist';
  end if;
end
$$;

create unique index if not exists job_clocking_one_open_per_user_idx
  on public.job_clocking (user_id)
  where clock_out is null;

comment on index public.job_clocking_one_open_per_user_idx is
  'Prevents a user from being clocked onto more than one job at the same time.';

commit;

notify pgrst, 'reload schema';
