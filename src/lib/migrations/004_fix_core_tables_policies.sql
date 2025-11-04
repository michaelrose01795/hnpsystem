-- file location: supabase/migrations/004_fix_core_tables_policies.sql
-- Purpose: Drop existing policies and recreate proper ones for customers, jobs, vehicles

-- ============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================

-- Drop all policies on customers table
DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on jobs table
DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'jobs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on vehicles table
DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicles', policy_record.policyname);
  END LOOP;
END $$;

-- ============================================
-- STEP 2: CREATE NEW POLICIES FOR CUSTOMERS
-- ============================================

-- Staff can view customers
CREATE POLICY "staff_view_customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager',
      'workshop_technician',
      'sales_manager',
      'salesperson',
      'mot_tester'
    )
  );

-- Reception and managers can create customers
CREATE POLICY "reception_create_customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'sales_manager',
      'salesperson'
    )
  );

-- Reception and managers can update customers
CREATE POLICY "reception_update_customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'sales_manager'
    )
  );

-- Only admins can delete customers
CREATE POLICY "admin_delete_customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- STEP 3: CREATE NEW POLICIES FOR VEHICLES
-- ============================================

-- Staff can view vehicles
CREATE POLICY "staff_view_vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager',
      'workshop_technician',
      'mot_tester',
      'parts_staff',
      'sales_manager',
      'salesperson',
      'valeting_staff',
      'painting_staff'
    )
  );

-- Staff can create vehicles
CREATE POLICY "staff_create_vehicles"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager',
      'sales_manager',
      'salesperson'
    )
  );

-- Staff can update vehicles
CREATE POLICY "staff_update_vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager',
      'workshop_technician',
      'mot_tester'
    )
  );

-- Only admins can delete vehicles
CREATE POLICY "admin_delete_vehicles"
  ON public.vehicles FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- STEP 4: CREATE NEW POLICIES FOR JOBS
-- ============================================

-- Staff can view relevant jobs
CREATE POLICY "staff_view_jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    -- Managers and reception can see all jobs
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager',
      'parts_manager',
      'parts_staff'
    )
    -- Workshop technicians can see jobs assigned to them
    OR (
      get_user_role() IN ('workshop_technician', 'mot_tester', 'valeting_staff', 'painting_staff')
      AND assigned_to = get_current_user_id()
    )
  );

-- Reception and managers can create jobs
CREATE POLICY "reception_create_jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager'
    )
  );

-- Staff can update relevant jobs
CREATE POLICY "staff_update_jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (
    -- Managers and reception can update all jobs
    get_user_role() IN (
      'admin',
      'manager',
      'reception',
      'workshop_manager'
    )
    -- Technicians can update jobs assigned to them
    OR (
      get_user_role() IN ('workshop_technician', 'mot_tester', 'valeting_staff', 'painting_staff')
      AND assigned_to = get_current_user_id()
    )
  );

-- Only managers can delete jobs
CREATE POLICY "manager_delete_jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'manager', 'workshop_manager')
  );