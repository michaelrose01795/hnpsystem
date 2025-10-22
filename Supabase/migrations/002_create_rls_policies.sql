-- file location: supabase/migrations/002_create_rls_policies_final.sql
-- Purpose: Complete RLS policies matching your exact table structure
-- All column names match your database schema exactly

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's role from JWT token (Keycloak will provide this)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    'guest'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'guest';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's email from JWT token
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'email';
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user_id by matching email from JWT to users table
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS INTEGER AS $$
DECLARE
  uid INTEGER;
BEGIN
  SELECT user_id INTO uid 
  FROM public.users 
  WHERE email = get_user_email();
  RETURN uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Admins can view all users
CREATE POLICY "admin_view_all_users"
  ON public.users FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');

-- Users can view their own profile
CREATE POLICY "user_view_own_profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (email = get_user_email());

-- Managers can view all users
CREATE POLICY "manager_view_users"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('manager', 'workshop_manager', 'sales_manager', 'parts_manager')
  );

-- Admins can insert users
CREATE POLICY "admin_insert_users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

-- Admins can update users
CREATE POLICY "admin_update_users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin');

-- Users can update their own profile
CREATE POLICY "user_update_own_profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (email = get_user_email());

-- ============================================
-- PARTS INVENTORY POLICIES
-- ============================================

-- Parts and workshop staff can view inventory
CREATE POLICY "staff_view_parts_inventory"
  ON public.parts_inventory FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'parts_manager', 
      'parts_staff', 
      'workshop_manager', 
      'workshop_technician',
      'mot_tester'
    )
  );

-- Parts managers can insert inventory
CREATE POLICY "parts_manager_insert_inventory"
  ON public.parts_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'parts_manager', 'parts_staff')
  );

-- Parts staff can update inventory
CREATE POLICY "parts_staff_update_inventory"
  ON public.parts_inventory FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'parts_manager', 'parts_staff')
  );

-- Only admins can delete inventory
CREATE POLICY "admin_delete_inventory"
  ON public.parts_inventory FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- PARTS REQUESTS POLICIES
-- ============================================

-- Workshop staff can create parts requests
CREATE POLICY "workshop_create_parts_requests"
  ON public.parts_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester'
    )
  );

-- Users can view requests they created
CREATE POLICY "user_view_own_parts_requests"
  ON public.parts_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = get_current_user_id()
    OR get_user_role() IN ('admin', 'parts_manager', 'parts_staff', 'workshop_manager')
  );

-- Parts staff can update request status
CREATE POLICY "parts_staff_update_requests"
  ON public.parts_requests FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'parts_manager', 'parts_staff')
  );

-- Managers can delete parts requests
CREATE POLICY "manager_delete_parts_requests"
  ON public.parts_requests FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'parts_manager', 'workshop_manager')
  );

-- ============================================
-- VHC CHECKS POLICIES
-- ============================================

-- Workshop and MOT staff can create VHC checks
CREATE POLICY "workshop_create_vhc_checks"
  ON public.vhc_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester'
    )
  );

-- Workshop staff and managers can view VHC checks
CREATE POLICY "staff_view_vhc_checks"
  ON public.vhc_checks FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester', 
      'manager'
    )
  );

-- Workshop staff can update VHC checks
CREATE POLICY "workshop_update_vhc_checks"
  ON public.vhc_checks FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester'
    )
  );

-- Managers can delete VHC checks
CREATE POLICY "manager_delete_vhc_checks"
  ON public.vhc_checks FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'workshop_manager')
  );

-- ============================================
-- SALES TRACKING POLICIES
-- ============================================

-- Sales staff can create sales records
CREATE POLICY "sales_create_tracking"
  ON public.sales_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'sales_manager', 'salesperson')
  );

-- Sales staff view own sales, managers view all
CREATE POLICY "sales_view_tracking"
  ON public.sales_tracking FOR SELECT
  TO authenticated
  USING (
    sold_by = get_current_user_id()
    OR get_user_role() IN ('admin', 'sales_manager', 'manager')
  );

-- Sales managers can update sales records
CREATE POLICY "sales_manager_update_tracking"
  ON public.sales_tracking FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'sales_manager')
  );

-- Admins can delete sales records
CREATE POLICY "admin_delete_sales_tracking"
  ON public.sales_tracking FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- Authenticated users can send messages
CREATE POLICY "user_send_messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = get_current_user_id());

-- Users can view messages they sent or received
CREATE POLICY "user_view_messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    sender_id = get_current_user_id() 
    OR receiver_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- Users can update messages (mark as read)
CREATE POLICY "user_update_messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    receiver_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- Users can delete their own messages
CREATE POLICY "user_delete_messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    sender_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- System can create notifications (any authenticated user)
CREATE POLICY "system_create_notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can view their own notifications
CREATE POLICY "user_view_notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "user_update_notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = get_current_user_id());

-- Users can delete their own notifications
CREATE POLICY "user_delete_notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = get_current_user_id());

-- ============================================
-- ACTIVITY LOGS POLICIES
-- ============================================

-- System can create activity logs
CREATE POLICY "system_create_activity_logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins and managers can view all logs
CREATE POLICY "manager_view_activity_logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'manager', 
      'workshop_manager', 
      'sales_manager', 
      'parts_manager'
    )
  );

-- Users can view their own activity
CREATE POLICY "user_view_own_activity"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (user_id = get_current_user_id());

-- Only admins can delete activity logs
CREATE POLICY "admin_delete_activity_logs"
  ON public.activity_logs FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- JOB NOTES POLICIES
-- ============================================

-- Workshop staff can create job notes
CREATE POLICY "workshop_create_job_notes"
  ON public.job_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester'
    )
  );

-- Workshop staff can view job notes
CREATE POLICY "workshop_view_job_notes"
  ON public.job_notes FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester', 
      'manager'
    )
  );

-- Users can update their own notes, managers can update all
CREATE POLICY "user_update_job_notes"
  ON public.job_notes FOR UPDATE
  TO authenticated
  USING (
    user_id = get_current_user_id()
    OR get_user_role() IN ('admin', 'workshop_manager')
  );

-- Managers can delete job notes
CREATE POLICY "manager_delete_job_notes"
  ON public.job_notes FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'workshop_manager')
  );

-- ============================================
-- JOB WRITEUPS POLICIES
-- ============================================

-- Workshop staff can create writeups
CREATE POLICY "workshop_create_writeups"
  ON public.job_writeups FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician'
    )
  );

-- Workshop staff can view writeups
CREATE POLICY "workshop_view_writeups"
  ON public.job_writeups FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'manager', 
      'mot_tester'
    )
  );

-- Technicians can update their own writeups, managers can update all
CREATE POLICY "technician_update_writeups"
  ON public.job_writeups FOR UPDATE
  TO authenticated
  USING (
    technician_id = get_current_user_id()
    OR get_user_role() IN ('admin', 'workshop_manager')
  );

-- Managers can delete writeups
CREATE POLICY "manager_delete_writeups"
  ON public.job_writeups FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'workshop_manager')
  );

-- ============================================
-- JOB FILES POLICIES
-- ============================================

-- Workshop staff can upload files
CREATE POLICY "workshop_upload_files"
  ON public.job_files FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'mot_tester'
    )
  );

-- Workshop and parts staff can view files
CREATE POLICY "staff_view_files"
  ON public.job_files FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'workshop_manager', 
      'workshop_technician', 
      'manager', 
      'mot_tester', 
      'parts_staff'
    )
  );

-- Users can update files they uploaded, managers can update all
CREATE POLICY "user_update_files"
  ON public.job_files FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = get_current_user_id()
    OR get_user_role() IN ('admin', 'workshop_manager')
  );

-- Managers can delete files
CREATE POLICY "manager_delete_files"
  ON public.job_files FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'workshop_manager')
  );

-- ============================================
-- APPOINTMENTS POLICIES
-- ============================================

-- Reception and managers can create appointments
CREATE POLICY "reception_create_appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin', 
      'manager', 
      'reception', 
      'workshop_manager'
    )
  );

-- Staff can view appointments
CREATE POLICY "staff_view_appointments"
  ON public.appointments FOR SELECT
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

-- Reception and managers can update appointments
CREATE POLICY "reception_update_appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin', 
      'manager', 
      'reception', 
      'workshop_manager'
    )
  );

-- Managers can delete appointments
CREATE POLICY "manager_delete_appointments"
  ON public.appointments FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'manager', 'workshop_manager')
  );
