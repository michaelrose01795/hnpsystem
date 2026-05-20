-- ============================================================================
-- RESTORE NEXTAUTH APP ACCESS AFTER GLOBAL RLS ENABLEMENT
-- ============================================================================
--
-- HNPSystem currently authenticates staff with NextAuth credentials, not
-- Supabase Auth. Browser-side Supabase calls therefore reach PostgREST as the
-- Supabase "anon" role even when the user is signed in to the app.
--
-- If Row-Level Security is enabled across the database without policies for
-- anon/authenticated, existing reads and writes return empty/permission errors.
--
-- This migration restores the app's previous access model by adding a
-- compatibility policy to every ordinary table in the public schema. It is
-- intentionally broad so the deployed app loads again while the remaining
-- client-side Supabase calls are moved behind server-side API routes or a
-- proper Supabase Auth/custom-JWT policy model.
--
-- Security note:
--   This does NOT make RLS restrictive for the affected tables. It makes RLS
--   explicit-but-permissive for anon/authenticated, matching how the app
--   behaved before RLS was enabled globally with the public anon key.
-- ============================================================================

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tableowner IS NOT NULL
    ORDER BY tablename
  LOOP
    policy_name := 'hnp_nextauth_compat_' || substr(md5(table_name), 1, 12);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      policy_name,
      table_name
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated;', table_name);
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
