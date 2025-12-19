-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

CREATE TABLE public.parts_delivery_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  invoice_number text,
  job_id integer,
  customer_id uuid,
  customer_name text,
  part_name text,
  part_number text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_method text,
  is_paid boolean NOT NULL DEFAULT false,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'en_route'::text, 'completed'::text])),
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_delivery_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT parts_delivery_jobs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT parts_delivery_jobs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_delivery_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE INDEX parts_delivery_jobs_delivery_date_idx ON public.parts_delivery_jobs (delivery_date);
CREATE INDEX parts_delivery_jobs_status_idx ON public.parts_delivery_jobs (status);

CREATE SEQUENCE public.parts_job_cards_job_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE public.parts_job_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE DEFAULT (
    'P' || lpad(nextval('parts_job_cards_job_number_seq')::text, 5, '0')
  ),
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'booked'::text, 'ready'::text, 'complete'::text])),
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])),
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,
  vehicle_id integer,
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  vehicle_vin text,
  vehicle_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  delivery_type text,
  delivery_address text,
  delivery_contact text,
  delivery_phone text,
  delivery_eta date,
  delivery_window text,
  delivery_status text NOT NULL DEFAULT 'pending'::text CHECK (delivery_status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'dispatched'::text, 'delivered'::text])),
  delivery_notes text,
  invoice_reference text,
  invoice_total numeric DEFAULT 0,
  invoice_status text NOT NULL DEFAULT 'draft'::text CHECK (invoice_status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'cancelled'::text])),
  invoice_notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_job_cards_pkey PRIMARY KEY (id),
  CONSTRAINT parts_job_cards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT parts_job_cards_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id)
);

CREATE TABLE public.parts_job_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  part_number text,
  part_name text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'booked'::text CHECK (status = ANY (ARRAY['booked'::text, 'allocated'::text, 'collected'::text, 'cancelled'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_job_items_pkey PRIMARY KEY (id),
  CONSTRAINT parts_job_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.parts_job_cards(id) ON DELETE CASCADE
);

CREATE INDEX parts_job_items_job_id_idx ON public.parts_job_items (job_id);
