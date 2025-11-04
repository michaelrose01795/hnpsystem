-- file location: supabase/migrations/003_secure_core_tables.sql
-- Purpose: Secure the customers, jobs, and vehicles tables with proper RLS policies
-- These are core DMS tables that need comprehensive access control

-- ============================================
-- CUSTOMERS TABLE POLICIES
-- ============================================
-- Note: customers.id is UUID type

-- Staff can view customers (needed for creating jobs, appointments, etc)
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
-- VEHICLES TABLE POLICIES
-- ============================================
-- Note: vehicles.vehicle_id is integer, but customer_id is UUID

-- Staff can view vehicles (needed for jobs and service history)
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

-- Reception, workshop, and sales can create vehicles
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

-- Staff can update vehicles (mileage, service history, etc)
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
-- JOBS TABLE POLICIES
-- ============================================
-- Note: This is the CORE table linking everything together
-- jobs.id is integer, customer_id is UUID, assigned_to is integer (user_id)

-- Staff can view jobs relevant to their role
CREATE POLICY "staff_view_jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
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
      get_user_role() = 'workshop_technician' 
      AND assigned_to = get_current_user_id()
    )
    -- MOT testers can see jobs with MOT category
    OR (
      get_user_role() = 'mot_tester'
      AND 'MOT' = ANY(job_categories)
    )
    -- Valeting staff can see jobs with valeting category
    OR (
      get_user_role() = 'valeting_staff'
      AND 'Valeting' = ANY(job_categories)
    )
    -- Painting staff can see jobs with painting category
    OR (
      get_user_role() = 'painting_staff'
      AND 'Painting' = ANY(job_categories)
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

-- Staff can update jobs based on their role
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
    -- Workshop technicians can update jobs assigned to them
    OR (
      get_user_role() = 'workshop_technician' 
      AND assigned_to = get_current_user_id()
    )
    -- MOT testers can update their MOT jobs
    OR (
      get_user_role() = 'mot_tester'
      AND 'MOT' = ANY(job_categories)
    )
    -- Valeting staff can update valeting jobs
    OR (
      get_user_role() = 'valeting_staff'
      AND 'Valeting' = ANY(job_categories)
    )
    -- Painting staff can update painting jobs
    OR (
      get_user_role() = 'painting_staff'
      AND 'Painting' = ANY(job_categories)
    )
  );

-- Only managers can delete jobs
CREATE POLICY "manager_delete_jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'manager', 'workshop_manager')
  );

-- ============================================
-- ADDITIONAL HELPER POLICIES FOR JOBS
-- ============================================

-- Allow parts staff to view jobs when processing parts requests
CREATE POLICY "parts_view_jobs_for_requests"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('parts_staff', 'parts_manager')
    AND id IN (
      SELECT job_id FROM public.parts_requests
    )
  );

-- ============================================
-- VERIFICATION COMMENT
-- ============================================
-- After running this migration, verify with:
-- SELECT tablename, COUNT(*) as policy_count 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('customers', 'jobs', 'vehicles')
-- GROUP BY tablename;
-- 
-- Expected results:
-- customers: 4 policies
-- jobs: 5 policies (including the helper policy)
-- vehicles: 4 policies