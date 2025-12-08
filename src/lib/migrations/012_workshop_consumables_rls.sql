-- file location: src/lib/migrations/012_workshop_consumables_rls.sql
-- Purpose: Create RLS policies for workshop consumables tables
-- This migration ensures proper access control for the workshop consumables tracker

-- ============================================
-- WORKSHOP_CONSUMABLES TABLE POLICIES
-- ============================================

-- Enable RLS on workshop_consumables table if not already enabled
ALTER TABLE public.workshop_consumables ENABLE ROW LEVEL SECURITY;

-- Workshop managers can view all consumables
CREATE POLICY "workshop_manager_view_consumables"
  ON public.workshop_consumables FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can insert new consumables
CREATE POLICY "workshop_manager_insert_consumables"
  ON public.workshop_consumables FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can update consumables
CREATE POLICY "workshop_manager_update_consumables"
  ON public.workshop_consumables FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Only admins can delete consumables
CREATE POLICY "admin_delete_consumables"
  ON public.workshop_consumables FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- WORKSHOP_CONSUMABLE_ORDERS TABLE POLICIES
-- ============================================

-- Enable RLS on workshop_consumable_orders table if not already enabled
ALTER TABLE public.workshop_consumable_orders ENABLE ROW LEVEL SECURITY;

-- Workshop managers can view all consumable orders
CREATE POLICY "workshop_manager_view_consumable_orders"
  ON public.workshop_consumable_orders FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can insert new consumable orders
CREATE POLICY "workshop_manager_insert_consumable_orders"
  ON public.workshop_consumable_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can update consumable orders
CREATE POLICY "workshop_manager_update_consumable_orders"
  ON public.workshop_consumable_orders FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Only admins can delete consumable orders
CREATE POLICY "admin_delete_consumable_orders"
  ON public.workshop_consumable_orders FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- WORKSHOP_CONSUMABLE_REQUESTS TABLE POLICIES
-- ============================================

-- Enable RLS on workshop_consumable_requests table if not already enabled
ALTER TABLE public.workshop_consumable_requests ENABLE ROW LEVEL SECURITY;

-- Workshop technicians can create consumable requests
CREATE POLICY "workshop_technician_create_consumable_requests"
  ON public.workshop_consumable_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'workshop_manager',
      'workshop_technician',
      'mot_tester'
    )
  );

-- Workshop managers and technicians can view consumable requests
CREATE POLICY "workshop_staff_view_consumable_requests"
  ON public.workshop_consumable_requests FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager',
      'workshop_technician',
      'mot_tester'
    )
  );

-- Workshop managers can update consumable request status
CREATE POLICY "workshop_manager_update_consumable_requests"
  ON public.workshop_consumable_requests FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can delete consumable requests
CREATE POLICY "workshop_manager_delete_consumable_requests"
  ON public.workshop_consumable_requests FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- ============================================
-- WORKSHOP_CONSUMABLE_BUDGETS TABLE POLICIES
-- ============================================

-- Enable RLS on workshop_consumable_budgets table if not already enabled
ALTER TABLE public.workshop_consumable_budgets ENABLE ROW LEVEL SECURITY;

-- Workshop managers can view budgets
CREATE POLICY "workshop_manager_view_consumable_budgets"
  ON public.workshop_consumable_budgets FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager',
      'manager'
    )
  );

-- Workshop managers can insert and upsert budgets
CREATE POLICY "workshop_manager_insert_consumable_budgets"
  ON public.workshop_consumable_budgets FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Workshop managers can update budgets
CREATE POLICY "workshop_manager_update_consumable_budgets"
  ON public.workshop_consumable_budgets FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN (
      'admin',
      'workshop_manager'
    )
  );

-- Only admins can delete budgets
CREATE POLICY "admin_delete_consumable_budgets"
  ON public.workshop_consumable_budgets FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');
