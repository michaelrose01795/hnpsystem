begin;

-- NextAuth (and the future Keycloak provider) is the application identity
-- boundary. Browser Supabase requests carry only the public anon key, so
-- sensitive domains must be reached through authenticated API routes using
-- the service role rather than through permissive public RLS policies.

revoke create on schema public from public, anon, authenticated;

-- Keep extensions outside the exposed application schema. Existing indexes
-- and stored expressions retain their OID dependencies when pg_trgm moves.
create schema if not exists extensions;

do $$
declare
  extension_is_relocatable boolean;
begin
  select e.extrelocatable
    into extension_is_relocatable
  from pg_extension e
  where e.extname = 'pg_trgm'
    and e.extnamespace = 'public'::regnamespace;

  if extension_is_relocatable then
    alter extension pg_trgm set schema extensions;
  end if;
end
$$;

grant usage on schema extensions to anon, authenticated, service_role;

-- These tables are already accessed only behind authenticated application
-- APIs. RLS with no public policy is intentional: service_role bypasses RLS,
-- while PostgREST's anon/authenticated roles receive no table privilege.
do $$
declare
  table_name text;
  policy_row record;
  server_only_tables constant text[] := array[
    'audit_log',
    'auth_login_attempts',
    'breach_records',
    'consent_records',
    'cookie_consents',
    'customer_auth',
    'customer_payment_methods',
    'dpia_records',
    'hr_absences',
    'hr_disciplinary_cases',
    'hr_payroll_adjustments',
    'hr_payroll_runs',
    'hr_performance_reviews',
    'hr_training_assignments',
    'hr_training_courses',
    'overtime_periods',
    'overtime_recurring_rules',
    'overtime_sessions',
    'payslips',
    'personal_attachments',
    'personal_bills',
    'personal_goals',
    'personal_notes',
    'personal_savings',
    'personal_transactions',
    'processing_activities',
    'retention_policies',
    'retention_runs',
    'shop_cart_items',
    'shop_carts',
    'shop_order_items',
    'shop_orders',
    'staff_vehicle_history',
    'staff_vehicle_payroll_deductions',
    'staff_vehicles',
    'subject_requests',
    'user_personal_layout',
    'user_personal_security',
    'user_personal_state',
    'user_personal_widget_data',
    'user_personal_widgets',
    'website_activity',
    'website_media',
    'website_pages',
    'website_seo'
  ];
begin
  foreach table_name in array server_only_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );

    if has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'Public database privilege remains on sensitive table public.%', table_name;
    end if;

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname like 'hnp_nextauth_compat_%'
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        table_name
      );
    end loop;
  end loop;
end
$$;

-- Public website content is read-only. Published collections additionally
-- hide draft rows even when queried directly through PostgREST.
do $$
declare
  public_table record;
  policy_row record;
begin
  for public_table in
    select *
    from (values
      ('website_about', 'true'),
      ('website_brand', 'true'),
      ('website_contact', 'true'),
      ('website_footer', 'true'),
      ('website_hero', 'true'),
      ('website_motability', 'true'),
      ('website_parts_content', 'true'),
      ('website_sell_your_car', 'true'),
      ('website_service_parts', 'true'),
      ('website_team_departments', 'true'),
      ('website_timeline', 'true'),
      ('welcome_quotes', 'true'),
      ('website_blog_posts', 'status = ''published'''),
      ('website_offers', 'status = ''published'''),
      ('website_partner_brands', 'status = ''published'''),
      ('website_ratings', 'status = ''published'''),
      ('website_reviews', 'status = ''published'''),
      ('website_team_members', 'status = ''published'''),
      ('website_trust_points', 'status = ''published'''),
      ('website_vehicles', 'status = ''published''')
    ) as configured(table_name, predicate)
  loop
    if to_regclass(format('public.%I', public_table.table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', public_table.table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      public_table.table_name
    );
    execute format(
      'grant select on table public.%I to anon, authenticated',
      public_table.table_name
    );

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = public_table.table_name
        and (
          policyname like 'hnp_nextauth_compat_%'
          or policyname = 'hnp_public_read_only'
        )
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        public_table.table_name
      );
    end loop;

    execute format(
      'create policy hnp_public_read_only on public.%I for select to anon, authenticated using (%s)',
      public_table.table_name,
      public_table.predicate
    );
  end loop;
end
$$;

-- Existing browser-side workshop rosters, messaging pickers and pre-login
-- theme resolution need a small read-only staff directory, not the password,
-- payroll, address, emergency-contact, document or signature fields previously
-- exposed by a table-wide ALL policy.
do $$
declare
  policy_row record;
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;
    revoke all privileges on table public.users from public, anon, authenticated;
    grant select (
      user_id,
      first_name,
      last_name,
      name,
      email,
      role,
      job_title,
      department,
      photo_url,
      contracted_hours,
      is_active,
      created_at,
      dark_mode,
      accent_color
    ) on public.users to anon, authenticated;

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'users'
        and (
          policyname like 'hnp_nextauth_compat_%'
          or policyname = 'hnp_staff_directory_read_only'
        )
    loop
      execute format('drop policy if exists %I on public.users', policy_row.policyname);
    end loop;

    create policy hnp_staff_directory_read_only
      on public.users
      for select
      to anon, authenticated
      using (is_active = true);
  end if;
end
$$;

-- A fixed search path prevents caller-controlled object resolution. public is
-- safe here because CREATE was revoked above; extensions is required by
-- functions that use pgcrypto/pg_trgm objects without schema qualification.
do $$
declare
  function_row record;
  hardened_function_names constant text[] := array[
    'audit_reject_event_mutation',
    'audit_safe_row_snapshot',
    'fill_job_number_from_jobs',
    'get_current_user_id',
    'get_job_timeline',
    'get_job_total_hours',
    'get_technician_daily_hours',
    'get_user_email',
    'get_user_role',
    'handle_job_status_change',
    'is_user_clocked_in',
    'log_loan_car_fuel_change',
    'normalise_vhc_decision_status',
    'parts_job_items_fill_part_snapshots',
    'refresh_vhc_totals_on_checksheet',
    'resolve_job_id_from_token',
    'set_floating_notes_updated_at',
    'set_job_request_presets_updated_at',
    'set_job_writeup_tasks_updated_at',
    'set_row_updated_at',
    'set_updated_at',
    'set_user_name',
    'sync_job_identity_columns',
    'sync_parts_job_item_row_description',
    'tr_jobs_broadcast',
    'tr_messages_broadcast',
    'tr_notifications_broadcast',
    'trg_normalise_vhc_checks_statuses',
    'trg_refresh_vhc_totals_from_vhc_checks',
    'update_customer_name',
    'update_job_status_from_progress',
    'update_updated_at_column',
    'vhc_customer_media_set_updated_at'
  ];
begin
  for function_row in
    select p.oid::regprocedure as function_identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(hardened_function_names)
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, extensions',
      function_row.function_identity
    );
  end loop;
end
$$;

-- Trigger functions are invoked by PostgreSQL triggers, never as PostgREST
-- RPC endpoints. The timeline RPC is the sole listed definer function called
-- by the application and is now service-role-only behind withRoleGuard.
do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as function_identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.prorettype = 'pg_catalog.trigger'::regtype
        or p.proname in (
          'capture_tracked_audit_change',
          'get_current_user_id',
          'get_job_timeline',
          'get_user_email',
          'get_user_role',
          'tr_jobs_broadcast',
          'tr_messages_broadcast',
          'tr_notifications_broadcast'
        )
      )
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      function_row.function_identity
    );
  end loop;

  if to_regprocedure('public.get_job_timeline(integer)') is not null then
    grant execute on function public.get_job_timeline(integer) to service_role;
  end if;

  if to_regprocedure('public.mark_workshop_consumable_request_arrived(uuid,uuid)') is not null then
    revoke all privileges on function public.mark_workshop_consumable_request_arrived(uuid, uuid)
      from public, anon, authenticated;
    grant execute on function public.mark_workshop_consumable_request_arrived(uuid, uuid)
      to service_role;
  end if;
end
$$;

-- Fail atomically if inherited grants or an unexpected role membership leave
-- any of the principal sensitive surfaces reachable after the migration.
do $$
declare
  table_name text;
  checked_tables constant text[] := array[
    'customer_auth',
    'hr_disciplinary_cases',
    'payslips',
    'personal_transactions',
    'staff_vehicle_history',
    'subject_requests',
    'user_personal_security'
  ];
begin
  foreach table_name in array checked_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    if has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'Public database privilege remains on sensitive table public.%', table_name;
    end if;
  end loop;

  if to_regclass('public.users') is not null and (
    has_column_privilege('anon', 'public.users', 'password_hash', 'SELECT')
    or has_column_privilege('authenticated', 'public.users', 'password_hash', 'SELECT')
    or has_column_privilege('anon', 'public.users', 'national_insurance_number', 'SELECT')
    or has_column_privilege('authenticated', 'public.users', 'national_insurance_number', 'SELECT')
  ) then
    raise exception 'Sensitive public.users columns remain publicly readable';
  end if;

  if to_regprocedure('public.get_job_timeline(integer)') is not null and (
    has_function_privilege('anon', 'public.get_job_timeline(integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.get_job_timeline(integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.get_job_timeline(integer)', 'EXECUTE')
  ) then
    raise exception 'get_job_timeline execute privileges do not match the service-only contract';
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
