-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL,
  driver_id uuid,
  vehicle_reg text,
  vehicle_mpg numeric DEFAULT 0,
  fuel_type text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  stop_number integer NOT NULL,
  job_id uuid,
  customer_id uuid NOT NULL,
  address text,
  postcode text,
  mileage_for_leg numeric NOT NULL DEFAULT 0,
  estimated_fuel_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'en_route'::text, 'delivered'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_stops_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_stops_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id),
  CONSTRAINT delivery_stops_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT delivery_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE TABLE public.delivery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  diesel_price_per_litre numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_settings_pkey PRIMARY KEY (id)
);
