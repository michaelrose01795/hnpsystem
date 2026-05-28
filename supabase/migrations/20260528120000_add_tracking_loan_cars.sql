CREATE TABLE IF NOT EXISTS public.tracking_loan_cars (
  loan_car_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reg text NOT NULL UNIQUE,
  name text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tracking_loan_cars_pkey PRIMARY KEY (loan_car_id)
);

CREATE TABLE IF NOT EXISTS public.tracking_loan_car_bookings (
  booking_id uuid NOT NULL DEFAULT gen_random_uuid(),
  loan_car_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  job_id integer,
  job_number text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_postcode text,
  vehicle_reg text,
  vehicle_make_model text,
  mileage integer,
  insurance_provider text,
  insurance_policy_number text,
  licence_number text,
  date_of_birth date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tracking_loan_car_bookings_pkey PRIMARY KEY (booking_id),
  CONSTRAINT tracking_loan_car_bookings_date_check CHECK (end_date >= start_date),
  CONSTRAINT tracking_loan_car_bookings_loan_car_id_fkey FOREIGN KEY (loan_car_id) REFERENCES public.tracking_loan_cars(loan_car_id) ON DELETE CASCADE,
  CONSTRAINT tracking_loan_car_bookings_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_loan_car_bookings_loan_car_dates
  ON public.tracking_loan_car_bookings (loan_car_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_tracking_loan_car_bookings_job_number
  ON public.tracking_loan_car_bookings (job_number);
