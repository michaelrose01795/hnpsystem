-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- ============================================
-- WORKSHOP_CONSUMABLE_BUDGETS TABLE
-- ============================================
-- This table stores monthly budgets for workshop consumables
-- It allows workshop managers to set and track spending limits per month

CREATE TABLE IF NOT EXISTS public.workshop_consumable_budgets (
  -- Primary key: combination of year and month ensures one budget per month
  budget_id bigint NOT NULL DEFAULT nextval('workshop_consumable_budgets_budget_id_seq'::regclass),

  -- Year for which this budget applies (e.g., 2025)
  year integer NOT NULL,

  -- Month for which this budget applies (1-12)
  month integer NOT NULL,

  -- Monthly budget amount in the system currency (e.g., GBP)
  monthly_budget numeric NOT NULL DEFAULT 0,

  -- User ID of the person who last updated this budget
  updated_by integer,

  -- Timestamp of when this budget was last updated
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Primary key constraint
  CONSTRAINT workshop_consumable_budgets_pkey PRIMARY KEY (budget_id),

  -- Unique constraint: only one budget per year-month combination
  CONSTRAINT workshop_consumable_budgets_year_month_key UNIQUE (year, month),

  -- Foreign key: link to the user who updated the budget
  CONSTRAINT workshop_consumable_budgets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id),

  -- Check constraint: month must be between 1 and 12
  CONSTRAINT workshop_consumable_budgets_month_check CHECK (month >= 1 AND month <= 12),

  -- Check constraint: monthly budget cannot be negative
  CONSTRAINT workshop_consumable_budgets_monthly_budget_check CHECK (monthly_budget >= 0)
);

-- Create sequence for budget_id if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.workshop_consumable_budgets_budget_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Link the sequence to the budget_id column
ALTER SEQUENCE public.workshop_consumable_budgets_budget_id_seq
  OWNED BY public.workshop_consumable_budgets.budget_id;

-- Create index on year and month for faster lookups
CREATE INDEX IF NOT EXISTS idx_workshop_consumable_budgets_year_month
  ON public.workshop_consumable_budgets(year, month);

-- Create index on updated_at for tracking changes
CREATE INDEX IF NOT EXISTS idx_workshop_consumable_budgets_updated_at
  ON public.workshop_consumable_budgets(updated_at);

-- Add comment to the table
COMMENT ON TABLE public.workshop_consumable_budgets IS
  'Stores monthly budgets for workshop consumables tracking. One record per year-month combination.';

-- Add comments to columns
COMMENT ON COLUMN public.workshop_consumable_budgets.budget_id IS
  'Primary key for the budget record';
COMMENT ON COLUMN public.workshop_consumable_budgets.year IS
  'Calendar year for this budget (e.g., 2025)';
COMMENT ON COLUMN public.workshop_consumable_budgets.month IS
  'Calendar month for this budget (1=January, 12=December)';
COMMENT ON COLUMN public.workshop_consumable_budgets.monthly_budget IS
  'Budget amount allocated for consumables in this month';
COMMENT ON COLUMN public.workshop_consumable_budgets.updated_by IS
  'User ID of the person who last modified this budget';
COMMENT ON COLUMN public.workshop_consumable_budgets.updated_at IS
  'Timestamp of the last budget modification';
