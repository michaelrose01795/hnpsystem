-- Migration: Add VHC parts tracking fields to parts_job_items table
-- Description: Add fields for tracking authorized status, stock status, ETA information, and supplier reference

-- Add new columns to parts_job_items table
ALTER TABLE public.parts_job_items
  ADD COLUMN IF NOT EXISTS authorised boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_status text CHECK (stock_status IS NULL OR stock_status = ANY (ARRAY['in_stock'::text, 'no_stock'::text, 'back_order'::text])),
  ADD COLUMN IF NOT EXISTS eta_date date,
  ADD COLUMN IF NOT EXISTS eta_time time,
  ADD COLUMN IF NOT EXISTS supplier_reference text,
  ADD COLUMN IF NOT EXISTS labour_hours numeric DEFAULT 0;

-- Create index for faster queries on authorised status
CREATE INDEX IF NOT EXISTS idx_parts_job_items_authorised ON public.parts_job_items(authorised);

-- Create index for faster queries on stock_status
CREATE INDEX IF NOT EXISTS idx_parts_job_items_stock_status ON public.parts_job_items(stock_status);

-- Add comment for documentation
COMMENT ON COLUMN public.parts_job_items.authorised IS 'Whether the part has been authorised by the customer from VHC summary';
COMMENT ON COLUMN public.parts_job_items.stock_status IS 'Stock availability status: in_stock, no_stock, back_order';
COMMENT ON COLUMN public.parts_job_items.eta_date IS 'Estimated arrival date for parts on order';
COMMENT ON COLUMN public.parts_job_items.eta_time IS 'Estimated arrival time for parts on order';
COMMENT ON COLUMN public.parts_job_items.supplier_reference IS 'Supplier reference number for tracking';
COMMENT ON COLUMN public.parts_job_items.labour_hours IS 'Labour hours required for fitting this part (linked from VHC)';
