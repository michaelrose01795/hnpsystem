-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid,
  customer_id uuid,
  total_parts numeric DEFAULT 0,
  total_labour numeric DEFAULT 0,
  total_vat numeric DEFAULT 0,
  total numeric DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  payment_method text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sent_email_at timestamp with time zone,
  sent_portal_at timestamp with time zone,
  CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);

CREATE TABLE public.payment_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  provider text NOT NULL,
  checkout_url text NOT NULL,
  expires_at timestamp with time zone,
  CONSTRAINT payment_links_pkey PRIMARY KEY (id),
  CONSTRAINT payment_links_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
