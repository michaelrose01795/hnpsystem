-- file location: src/lib/database/schema/schemaReference.sql
-- This file mirrors the database schema shared during the HR module scaffolding discussion.
-- Each entry represents a single column definition with its table, data type, nullability, and default.

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_settings (
  id integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.account_transactions (
  transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  transaction_date timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'Debit'::text,
  description text,
  job_number text,
  payment_method text,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT account_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(account_id)
);
CREATE TABLE public.accounts (
  account_id text NOT NULL,
  customer_id uuid,
  account_type text NOT NULL DEFAULT 'Retail'::text,
  balance numeric NOT NULL DEFAULT 0,
  credit_limit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active'::text,
  billing_name text,
  billing_email text,
  billing_phone text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_postcode text,
  billing_country text,
  credit_terms integer NOT NULL DEFAULT 30,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (account_id),
  CONSTRAINT accounts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.activity_logs (
  log_id integer NOT NULL DEFAULT nextval('activity_logs_log_id_seq'::regclass),
  user_id integer,
  action character varying,
  table_name character varying,
  record_id integer,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.appointment_day_capacity (
  capacity_id bigint NOT NULL DEFAULT nextval('appointment_day_capacity_capacity_id_seq'::regclass),
  day date NOT NULL UNIQUE,
  technicians_available integer NOT NULL,
  notes text,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_day_capacity_pkey PRIMARY KEY (capacity_id),
  CONSTRAINT appointment_day_capacity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.appointment_notes (
  note_id integer NOT NULL DEFAULT nextval('appointment_notes_note_id_seq'::regclass),
  appointment_id integer NOT NULL,
  user_id integer,
  note_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_notes_pkey PRIMARY KEY (note_id),
  CONSTRAINT appointment_notes_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(appointment_id),
  CONSTRAINT appointment_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.appointments (
  appointment_id integer NOT NULL DEFAULT nextval('appointments_appointment_id_seq'::regclass),
  job_id integer,
  customer_id uuid,
  scheduled_time timestamp with time zone NOT NULL,
  status character varying DEFAULT 'booked'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (appointment_id),
  CONSTRAINT appointments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.clocking (
  id bigint NOT NULL DEFAULT nextval('clocking_id_seq'::regclass),
  user_id integer NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  break_start timestamp with time zone,
  break_end timestamp with time zone,
  total_hours numeric,
  status character varying DEFAULT 'clocked_out'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clocking_pkey PRIMARY KEY (id),
  CONSTRAINT clocking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  setting_type text NOT NULL DEFAULT 'string'::text CHECK (setting_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'json'::text])),
  description text,
  updated_by integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_pkey PRIMARY KEY (id),
  CONSTRAINT company_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.consumable_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consumable_locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.consumable_stock_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consumable_id uuid NOT NULL,
  technician_id integer,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consumable_stock_checks_pkey PRIMARY KEY (id),
  CONSTRAINT consumable_stock_checks_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id),
  CONSTRAINT consumable_stock_checks_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.consumables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  location_id uuid,
  temporary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consumables_pkey PRIMARY KEY (id),
  CONSTRAINT consumables_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.consumable_locations(id)
);
CREATE TABLE public.customer_payment_methods (
  method_id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  nickname text,
  card_brand text,
  last4 text NOT NULL,
  expiry_month integer NOT NULL,
  expiry_year integer NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_payment_methods_pkey PRIMARY KEY (method_id),
  CONSTRAINT customer_payment_methods_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  firstname text,
  lastname text,
  email text,
  mobile text,
  telephone text,
  address text,
  postcode text,
  created_at timestamp with time zone DEFAULT now(),
  contact_preference text DEFAULT 'email'::text,
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL,
  driver_id uuid,
  vehicle_reg text,
  fuel_type text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  vehicle_mpg numeric DEFAULT 0,
  CONSTRAINT deliveries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delivery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  diesel_price_per_litre numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delivery_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  stop_number integer NOT NULL,
  job_id integer,
  customer_id uuid NOT NULL,
  address text,
  postcode text,
  mileage_for_leg numeric NOT NULL DEFAULT 0,
  estimated_fuel_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'en_route'::text, 'delivered'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT delivery_stops_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_stops_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT delivery_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT delivery_stops_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id)
);
CREATE TABLE public.hr_absences (
  absence_id bigint NOT NULL DEFAULT nextval('hr_absences_absence_id_seq'::regclass),
  user_id integer NOT NULL,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  approval_status text NOT NULL DEFAULT 'Pending'::text,
  approved_by integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT hr_absences_pkey PRIMARY KEY (absence_id),
  CONSTRAINT hr_absences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT hr_absences_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_access_roles (
  role_id bigint NOT NULL DEFAULT nextval('hr_access_roles_role_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_access_roles_pkey PRIMARY KEY (role_id)
);
CREATE TABLE public.hr_action_items (
  action_id bigint NOT NULL DEFAULT nextval('hr_action_items_action_id_seq'::regclass),
  review_id bigint,
  title text NOT NULL,
  owner_id integer,
  due_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  CONSTRAINT hr_action_items_pkey PRIMARY KEY (action_id),
  CONSTRAINT hr_action_items_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.hr_performance_reviews(review_id),
  CONSTRAINT hr_action_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_applicant_tasks (
  task_id bigint NOT NULL DEFAULT nextval('hr_applicant_tasks_task_id_seq'::regclass),
  applicant_id bigint,
  assignee_id integer,
  title text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_applicant_tasks_pkey PRIMARY KEY (task_id),
  CONSTRAINT hr_applicant_tasks_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.hr_applicants(applicant_id),
  CONSTRAINT hr_applicant_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_applicants (
  applicant_id bigint NOT NULL DEFAULT nextval('hr_applicants_applicant_id_seq'::regclass),
  job_id bigint,
  first_name text,
  last_name text,
  email text,
  phone text,
  resume_url text,
  status text NOT NULL DEFAULT 'applied'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_applicants_pkey PRIMARY KEY (applicant_id),
  CONSTRAINT hr_applicants_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.hr_recruitment_jobs(job_id)
);
CREATE TABLE public.hr_disciplinary_actions (
  action_id bigint NOT NULL DEFAULT nextval('hr_disciplinary_actions_action_id_seq'::regclass),
  case_id bigint,
  action_date date,
  action_type text,
  taken_by integer,
  notes text,
  CONSTRAINT hr_disciplinary_actions_pkey PRIMARY KEY (action_id),
  CONSTRAINT hr_disciplinary_actions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_disciplinary_cases(case_id),
  CONSTRAINT hr_disciplinary_actions_taken_by_fkey FOREIGN KEY (taken_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_disciplinary_cases (
  case_id bigint NOT NULL DEFAULT nextval('hr_disciplinary_cases_case_id_seq'::regclass),
  user_id integer NOT NULL,
  incident_date date NOT NULL,
  incident_type text NOT NULL,
  severity text,
  status text NOT NULL DEFAULT 'open'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_disciplinary_cases_pkey PRIMARY KEY (case_id),
  CONSTRAINT hr_disciplinary_cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_employee_profiles (
  profile_id bigint NOT NULL DEFAULT nextval('hr_employee_profiles_profile_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  department text,
  job_title text,
  employment_type text,
  start_date date,
  manager_id integer,
  photo_url text,
  emergency_contact jsonb,
  documents jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employment_status text,
  contracted_hours numeric,
  hourly_rate numeric,
  overtime_rate numeric,
  annual_salary numeric,
  payroll_reference text,
  national_insurance_number text,
  keycloak_user_id text,
  home_address text,
  CONSTRAINT hr_employee_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT hr_employee_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT hr_employee_profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_payroll_adjustments (
  adjustment_id bigint NOT NULL DEFAULT nextval('hr_payroll_adjustments_adjustment_id_seq'::regclass),
  payroll_id bigint,
  user_id integer NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_payroll_adjustments_pkey PRIMARY KEY (adjustment_id),
  CONSTRAINT hr_payroll_adjustments_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES public.hr_payroll_runs(payroll_id),
  CONSTRAINT hr_payroll_adjustments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_payroll_runs (
  payroll_id bigint NOT NULL DEFAULT nextval('hr_payroll_runs_payroll_id_seq'::regclass),
  period_start date NOT NULL,
  period_end date NOT NULL,
  processed_at timestamp with time zone,
  processed_by integer,
  status text NOT NULL DEFAULT 'draft'::text,
  CONSTRAINT hr_payroll_runs_pkey PRIMARY KEY (payroll_id),
  CONSTRAINT hr_payroll_runs_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_performance_goals (
  goal_id bigint NOT NULL DEFAULT nextval('hr_performance_goals_goal_id_seq'::regclass),
  user_id integer NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'open'::text,
  progress numeric DEFAULT 0,
  CONSTRAINT hr_performance_goals_pkey PRIMARY KEY (goal_id),
  CONSTRAINT hr_performance_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_performance_reviews (
  review_id bigint NOT NULL DEFAULT nextval('hr_performance_reviews_review_id_seq'::regclass),
  user_id integer NOT NULL,
  reviewer_id integer,
  scheduled_at timestamp with time zone,
  score jsonb,
  status text NOT NULL DEFAULT 'scheduled'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_performance_reviews_pkey PRIMARY KEY (review_id),
  CONSTRAINT hr_performance_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT hr_performance_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_policy_documents (
  policy_id bigint NOT NULL DEFAULT nextval('hr_policy_documents_policy_id_seq'::regclass),
  name text NOT NULL,
  category text,
  file_url text NOT NULL,
  version text,
  published_at timestamp with time zone DEFAULT now(),
  created_by integer,
  CONSTRAINT hr_policy_documents_pkey PRIMARY KEY (policy_id),
  CONSTRAINT hr_policy_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_recruitment_jobs (
  job_id bigint NOT NULL DEFAULT nextval('hr_recruitment_jobs_job_id_seq'::regclass),
  title text NOT NULL,
  department text,
  location text,
  status text NOT NULL DEFAULT 'open'::text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_recruitment_jobs_pkey PRIMARY KEY (job_id)
);
CREATE TABLE public.hr_reminder_tasks (
  reminder_id bigint NOT NULL DEFAULT nextval('hr_reminder_tasks_reminder_id_seq'::regclass),
  type text NOT NULL,
  payload jsonb,
  run_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_reminder_tasks_pkey PRIMARY KEY (reminder_id)
);
CREATE TABLE public.hr_shift_rules (
  rule_id bigint NOT NULL DEFAULT nextval('hr_shift_rules_rule_id_seq'::regclass),
  department text,
  rule_name text NOT NULL,
  details jsonb NOT NULL,
  effective_from date,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_shift_rules_pkey PRIMARY KEY (rule_id),
  CONSTRAINT hr_shift_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_training_assignments (
  assignment_id bigint NOT NULL DEFAULT nextval('hr_training_assignments_assignment_id_seq'::regclass),
  user_id integer NOT NULL,
  course_id bigint NOT NULL,
  assigned_by integer,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  due_date date,
  status text NOT NULL DEFAULT 'assigned'::text,
  completed_at timestamp with time zone,
  certificate_url text,
  CONSTRAINT hr_training_assignments_pkey PRIMARY KEY (assignment_id),
  CONSTRAINT hr_training_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT hr_training_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.hr_training_courses(course_id),
  CONSTRAINT hr_training_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.hr_training_courses (
  course_id bigint NOT NULL DEFAULT nextval('hr_training_courses_course_id_seq'::regclass),
  title text NOT NULL,
  description text,
  category text,
  renewal_interval_months integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hr_training_courses_pkey PRIMARY KEY (course_id)
);
CREATE TABLE public.hr_training_events (
  event_id bigint NOT NULL DEFAULT nextval('hr_training_events_event_id_seq'::regclass),
  course_id bigint,
  scheduled_at timestamp with time zone,
  location text,
  instructor text,
  capacity integer,
  notes text,
  CONSTRAINT hr_training_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT hr_training_events_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.hr_training_courses(course_id)
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
CREATE TABLE public.invoice_payments (
  payment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  reference text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_pkey PRIMARY KEY (payment_id),
  CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer,
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
  invoice_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  account_id text,
  job_number text,
  labour_total numeric DEFAULT 0,
  parts_total numeric DEFAULT 0,
  consumables_total numeric DEFAULT 0,
  vat numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  payment_status text DEFAULT 'Draft'::text,
  due_date date,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(account_id)
);
CREATE TABLE public.job_booking_requests (
  request_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  job_id integer NOT NULL UNIQUE,
  customer_id uuid,
  vehicle_id integer,
  description text NOT NULL,
  waiting_status text,
  status text NOT NULL DEFAULT 'pending'::text,
  submitted_by integer,
  submitted_by_name text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by integer,
  approved_by_name text,
  approved_at timestamp with time zone,
  confirmation_sent_at timestamp with time zone,
  price_estimate numeric,
  estimated_completion timestamp with time zone,
  loan_car_details text,
  confirmation_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_booking_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT job_booking_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_booking_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT job_booking_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id),
  CONSTRAINT job_booking_requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(user_id),
  CONSTRAINT job_booking_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.job_check_sheet_checkboxes (
  checkbox_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sheet_id bigint NOT NULL,
  label text,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  is_checked boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_check_sheet_checkboxes_pkey PRIMARY KEY (checkbox_id),
  CONSTRAINT job_check_sheet_checkboxes_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.job_check_sheets(sheet_id)
);
CREATE TABLE public.job_check_sheets (
  sheet_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  job_id integer NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  created_by integer,
  signature_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_check_sheets_pkey PRIMARY KEY (sheet_id),
  CONSTRAINT job_check_sheets_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_check_sheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.job_clocking (
  id integer NOT NULL DEFAULT nextval('job_clocking_id_seq'::regclass),
  user_id integer NOT NULL,
  job_id integer NOT NULL,
  job_number text NOT NULL,
  clock_in timestamp with time zone NOT NULL,
  clock_out timestamp with time zone,
  work_type text NOT NULL DEFAULT 'initial'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_clocking_pkey PRIMARY KEY (id),
  CONSTRAINT job_clocking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT job_clocking_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_cosmetic_damage (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  job_id integer NOT NULL UNIQUE,
  has_damage boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_cosmetic_damage_pkey PRIMARY KEY (id),
  CONSTRAINT job_cosmetic_damage_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_customer_statuses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  job_id integer NOT NULL,
  status text NOT NULL DEFAULT 'Neither'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_customer_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT job_customer_statuses_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_files (
  file_id integer NOT NULL DEFAULT nextval('job_files_file_id_seq'::regclass),
  job_id integer NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by integer,
  folder text DEFAULT 'general'::text,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_files_pkey PRIMARY KEY (file_id),
  CONSTRAINT job_files_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.job_notes (
  note_id integer NOT NULL DEFAULT nextval('job_notes_note_id_seq'::regclass),
  job_id integer NOT NULL,
  user_id integer,
  note_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  hidden_from_customer boolean DEFAULT true,
  last_updated_by integer,
  CONSTRAINT job_notes_pkey PRIMARY KEY (note_id),
  CONSTRAINT job_notes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT job_notes_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.job_progress (
  progress_id integer NOT NULL DEFAULT nextval('job_progress_progress_id_seq'::regclass),
  job_id integer NOT NULL,
  job_number text NOT NULL,
  status text NOT NULL,
  updated_by integer,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_progress_pkey PRIMARY KEY (progress_id),
  CONSTRAINT job_progress_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_progress_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.job_requests (
  request_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  job_id integer NOT NULL,
  description text NOT NULL,
  hours numeric,
  job_type text NOT NULL DEFAULT 'Customer'::text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT job_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_status_history (
  id integer NOT NULL DEFAULT nextval('job_status_history_id_seq'::regclass),
  job_id integer NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by text,
  reason text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT job_status_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_writeup_tasks (
  task_id bigint NOT NULL DEFAULT nextval('job_writeup_tasks_task_id_seq'::regclass),
  job_id integer NOT NULL,
  source text NOT NULL,
  source_key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'additional_work'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_writeup_tasks_pkey PRIMARY KEY (task_id),
  CONSTRAINT job_writeup_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.job_writeups (
  writeup_id integer NOT NULL DEFAULT nextval('job_writeups_writeup_id_seq'::regclass),
  job_id integer NOT NULL,
  technician_id integer,
  work_performed text,
  parts_used text,
  recommendations text,
  labour_time numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ratification text,
  warranty_claim text,
  tsr_number text,
  pwa_number text,
  technical_bulletins text,
  technical_signature text,
  quality_control text,
  qty jsonb DEFAULT '[]'::jsonb,
  booked jsonb DEFAULT '[]'::jsonb,
  cause_entries jsonb DEFAULT '[]'::jsonb,
  completion_status text DEFAULT 'additional_work'::text,
  rectification_notes text,
  job_description_snapshot text,
  vhc_authorization_reference integer,
  task_checklist jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT job_writeups_pkey PRIMARY KEY (writeup_id),
  CONSTRAINT job_writeups_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_writeups_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.jobs (
  id integer NOT NULL DEFAULT nextval('jobs_id_seq'::regclass),
  customer text,
  customer_id uuid,
  vehicle_reg text,
  vehicle_make_model text,
  waiting_status text,
  job_source text,
  job_categories ARRAY,
  requests jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  job_number text UNIQUE,
  vehicle_id integer,
  description text,
  type text DEFAULT 'Service'::text,
  status text DEFAULT 'New'::text,
  assigned_to integer,
  updated_at timestamp with time zone DEFAULT now(),
  cosmetic_notes text,
  vhc_required boolean DEFAULT false,
  maintenance_info jsonb,
  status_updated_at timestamp with time zone,
  status_updated_by text,
  checked_in_at timestamp with time zone,
  workshop_started_at timestamp with time zone,
  vhc_completed_at timestamp with time zone,
  vhc_sent_at timestamp with time zone,
  additional_work_authorized_at timestamp with time zone,
  additional_work_started_at timestamp with time zone,
  wash_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  parts_ordered_at timestamp with time zone,
  warranty_parts_ordered_at timestamp with time zone,
  warranty_qc_started_at timestamp with time zone,
  warranty_ready_at timestamp with time zone,
  mileage_at_service integer,
  completion_status text,
  rectification_notes text,
  job_description_snapshot text,
  vhc_authorization_reference text,
  task_checklist jsonb DEFAULT '{}'::jsonb,
  warranty_linked_job_id integer,
  warranty_vhc_master_job_id integer,
  delivery_confirmed_at timestamp with time zone,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(user_id),
  CONSTRAINT jobs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id),
  CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT jobs_warranty_linked_job_id_fkey FOREIGN KEY (warranty_linked_job_id) REFERENCES public.jobs(id),
  CONSTRAINT jobs_warranty_vhc_master_job_id_fkey FOREIGN KEY (warranty_vhc_master_job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.key_tracking_events (
  key_event_id bigint NOT NULL DEFAULT nextval('key_tracking_events_key_event_id_seq'::regclass),
  vehicle_id integer,
  job_id integer,
  action text NOT NULL,
  performed_by integer,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT key_tracking_events_pkey PRIMARY KEY (key_event_id),
  CONSTRAINT key_tracking_events_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id),
  CONSTRAINT key_tracking_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT key_tracking_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.message_thread_members (
  member_id integer NOT NULL DEFAULT nextval('message_thread_members_member_id_seq'::regclass),
  thread_id integer NOT NULL,
  user_id integer NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  last_read_at timestamp with time zone,
  CONSTRAINT message_thread_members_pkey PRIMARY KEY (member_id),
  CONSTRAINT message_thread_members_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(thread_id),
  CONSTRAINT message_thread_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.message_threads (
  thread_id integer NOT NULL DEFAULT nextval('message_threads_thread_id_seq'::regclass),
  thread_type text NOT NULL DEFAULT 'direct'::text CHECK (thread_type = ANY (ARRAY['direct'::text, 'group'::text])),
  title text,
  unique_hash text UNIQUE,
  created_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_threads_pkey PRIMARY KEY (thread_id),
  CONSTRAINT message_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.messages (
  message_id integer NOT NULL DEFAULT nextval('messages_message_id_seq'::regclass),
  sender_id integer,
  receiver_id integer,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  thread_id integer,
  metadata jsonb,
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id),
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(user_id),
  CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(thread_id)
);
CREATE TABLE public.notifications (
  notification_id integer NOT NULL DEFAULT nextval('notifications_notification_id_seq'::regclass),
  user_id integer,
  type character varying,
  message text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  target_role text,
  job_number text,
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.overtime_periods (
  period_id bigint NOT NULL DEFAULT nextval('overtime_periods_period_id_seq'::regclass),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  CONSTRAINT overtime_periods_pkey PRIMARY KEY (period_id)
);
CREATE TABLE public.overtime_sessions (
  session_id bigint NOT NULL DEFAULT nextval('overtime_sessions_session_id_seq'::regclass),
  period_id bigint,
  user_id integer NOT NULL,
  job_id integer,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  total_hours numeric DEFAULT ((EXTRACT(epoch FROM (end_time - start_time)) / (3600)::numeric))::numeric(5,2),
  approved_by integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT overtime_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT overtime_sessions_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.overtime_periods(period_id),
  CONSTRAINT overtime_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT overtime_sessions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT overtime_sessions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.part_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  keywords ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT part_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.part_delivery_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL,
  supplier text,
  order_reference text,
  qty_ordered integer NOT NULL DEFAULT 0,
  qty_received integer NOT NULL DEFAULT 0,
  unit_cost numeric,
  delivery_date date,
  notes text,
  created_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT part_delivery_logs_pkey PRIMARY KEY (id),
  CONSTRAINT part_delivery_logs_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id),
  CONSTRAINT part_delivery_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.parts_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  part_number text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  supplier text,
  oem_reference text,
  barcode text,
  unit_cost numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  qty_in_stock integer NOT NULL DEFAULT 0,
  qty_reserved integer NOT NULL DEFAULT 0,
  qty_on_order integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  storage_location text,
  service_default_zone text CHECK (service_default_zone IS NULL OR (service_default_zone = ANY (ARRAY['service_rack_1'::text, 'service_rack_2'::text, 'service_rack_3'::text, 'service_rack_4'::text]))),
  sales_default_zone text CHECK (sales_default_zone IS NULL OR (sales_default_zone = ANY (ARRAY['sales_rack_1'::text, 'sales_rack_2'::text, 'sales_rack_3'::text, 'sales_rack_4'::text]))),
  stairs_default_zone text CHECK (stairs_default_zone IS NULL OR stairs_default_zone = 'stairs_pre_pick'::text),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.parts_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier text,
  order_reference text,
  status text NOT NULL DEFAULT 'ordering'::text CHECK (status = ANY (ARRAY['ordering'::text, 'on_route'::text, 'received'::text, 'partial'::text, 'cancelled'::text])),
  expected_date date,
  received_date date,
  notes text,
  created_by integer,
  updated_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT parts_deliveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id),
  CONSTRAINT parts_deliveries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.parts_delivery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  part_id uuid NOT NULL,
  job_id integer,
  quantity_ordered integer NOT NULL DEFAULT 0,
  quantity_received integer NOT NULL DEFAULT 0,
  unit_cost numeric,
  unit_price numeric,
  status text NOT NULL DEFAULT 'ordered'::text CHECK (status = ANY (ARRAY['ordered'::text, 'backorder'::text, 'received'::text, 'cancelled'::text])),
  notes text,
  created_by integer,
  updated_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_delivery_items_pkey PRIMARY KEY (id),
  CONSTRAINT parts_delivery_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.parts_deliveries(id),
  CONSTRAINT parts_delivery_items_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id),
  CONSTRAINT parts_delivery_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_delivery_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id),
  CONSTRAINT parts_delivery_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);
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
CREATE TABLE public.parts_delivery_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer NOT NULL,
  customer_id uuid NOT NULL,
  delivery_date date NOT NULL,
  time_leave time without time zone,
  time_arrive time without time zone,
  mileage integer NOT NULL DEFAULT 0,
  fuel_cost numeric NOT NULL DEFAULT 0,
  stops_count integer NOT NULL DEFAULT 1,
  destination_address text,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'dispatched'::text, 'completed'::text, 'cancelled'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_delivery_runs_pkey PRIMARY KEY (id),
  CONSTRAINT parts_delivery_runs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_delivery_runs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.parts_delivery_settings (
  fuel_type text NOT NULL,
  price_per_litre numeric NOT NULL,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_delivery_settings_pkey PRIMARY KEY (fuel_type)
);
CREATE TABLE public.parts_inventory (
  part_id integer NOT NULL DEFAULT nextval('parts_inventory_part_id_seq'::regclass),
  part_number character varying NOT NULL UNIQUE,
  name character varying,
  description text,
  quantity integer DEFAULT 0,
  price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT parts_inventory_pkey PRIMARY KEY (part_id)
);
CREATE TABLE public.parts_job_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer NOT NULL,
  part_id uuid NOT NULL,
  quantity_requested integer NOT NULL DEFAULT 1,
  quantity_allocated integer NOT NULL DEFAULT 0,
  quantity_fitted integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'waiting_authorisation'::text, 'awaiting_stock'::text, 'on_order'::text, 'allocated'::text, 'pre_picked'::text, 'picked'::text, 'stock'::text, 'fitted'::text, 'cancelled'::text])),
  origin text DEFAULT 'vhc'::text,
  pre_pick_location text CHECK (pre_pick_location IS NULL OR (pre_pick_location = ANY (ARRAY['service_rack_1'::text, 'service_rack_2'::text, 'service_rack_3'::text, 'service_rack_4'::text, 'sales_rack_1'::text, 'sales_rack_2'::text, 'sales_rack_3'::text, 'sales_rack_4'::text, 'stairs_pre_pick'::text, 'no_pick'::text, 'on_order'::text]))),
  storage_location text,
  unit_cost numeric,
  unit_price numeric,
  request_notes text,
  allocated_by uuid,
  picked_by uuid,
  fitted_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  vhc_item_id integer,
  authorised boolean DEFAULT false,
  stock_status text CHECK (stock_status IS NULL OR (stock_status = ANY (ARRAY['in_stock'::text, 'no_stock'::text, 'back_order'::text]))),
  eta_date date,
  eta_time time without time zone,
  supplier_reference text,
  labour_hours numeric DEFAULT 0,
  allocated_to_request_id bigint,
  CONSTRAINT parts_job_items_pkey PRIMARY KEY (id),
  CONSTRAINT parts_job_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_job_items_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id),
  CONSTRAINT parts_job_items_vhc_item_id_fkey FOREIGN KEY (vhc_item_id) REFERENCES public.vhc_checks(vhc_id),
  CONSTRAINT parts_job_items_allocated_to_request_id_fkey FOREIGN KEY (allocated_to_request_id) REFERENCES public.job_requests(request_id)
);
CREATE TABLE public.parts_requests (
  request_id integer NOT NULL DEFAULT nextval('parts_requests_request_id_seq'::regclass),
  job_id integer,
  requested_by integer,
  approved_by integer,
  quantity integer DEFAULT 1,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  part_id uuid,
  description text,
  source text DEFAULT 'manual'::text,
  pre_pick_location text CHECK (pre_pick_location IS NULL OR (pre_pick_location = ANY (ARRAY['service_rack_1'::text, 'service_rack_2'::text, 'service_rack_3'::text, 'service_rack_4'::text, 'sales_rack_1'::text, 'sales_rack_2'::text, 'sales_rack_3'::text, 'sales_rack_4'::text, 'stairs_pre_pick'::text, 'no_pick'::text, 'on_order'::text]))),
  CONSTRAINT parts_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT parts_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id),
  CONSTRAINT parts_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id),
  CONSTRAINT parts_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_requests_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id)
);
CREATE TABLE public.parts_stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL,
  job_item_id uuid,
  delivery_item_id uuid,
  movement_type text NOT NULL CHECK (movement_type = ANY (ARRAY['delivery'::text, 'allocation'::text, 'return'::text, 'adjustment'::text, 'stock_take'::text, 'correction'::text])),
  quantity integer NOT NULL,
  unit_cost numeric,
  unit_price numeric,
  reference text,
  notes text,
  performed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT parts_stock_movements_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id),
  CONSTRAINT parts_stock_movements_job_item_id_fkey FOREIGN KEY (job_item_id) REFERENCES public.parts_job_items(id),
  CONSTRAINT parts_stock_movements_delivery_item_id_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.parts_delivery_items(id)
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
CREATE TABLE public.payment_plans (
  plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  job_id integer,
  invoice_id uuid,
  name text,
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  frequency text,
  next_payment_date date,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_plans_pkey PRIMARY KEY (plan_id),
  CONSTRAINT payment_plans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT payment_plans_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT payment_plans_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.sales_tracking (
  sale_id integer NOT NULL DEFAULT nextval('sales_tracking_sale_id_seq'::regclass),
  vehicle_id integer,
  sold_by integer,
  price numeric,
  sold_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_tracking_pkey PRIMARY KEY (sale_id),
  CONSTRAINT sales_tracking_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id),
  CONSTRAINT sales_tracking_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.schema_migrations (
  id integer NOT NULL DEFAULT nextval('schema_migrations_id_seq'::regclass),
  migration_name text NOT NULL UNIQUE,
  applied_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staff_vehicle_history (
  history_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  vehicle_id uuid NOT NULL,
  job_id integer,
  description text,
  cost numeric DEFAULT 0,
  deduct_from_payroll boolean NOT NULL DEFAULT true,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  payroll_processed_at timestamp with time zone,
  CONSTRAINT staff_vehicle_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT staff_vehicle_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.staff_vehicles(vehicle_id),
  CONSTRAINT staff_vehicle_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.staff_vehicles (
  vehicle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  make text,
  model text,
  registration text NOT NULL,
  vin text,
  colour text,
  payroll_deduction_enabled boolean NOT NULL DEFAULT true,
  payroll_deduction_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_vehicles_pkey PRIMARY KEY (vehicle_id),
  CONSTRAINT staff_vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.time_records (
  id bigint NOT NULL DEFAULT nextval('time_records_id_seq'::regclass),
  user_id integer NOT NULL,
  job_id integer,
  job_number text,
  date date NOT NULL,
  clock_in timestamp with time zone NOT NULL,
  clock_out timestamp with time zone,
  hours_worked numeric,
  break_minutes integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT time_records_pkey PRIMARY KEY (id),
  CONSTRAINT time_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT time_records_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.tyre_inspections (
  inspection_id bigint NOT NULL DEFAULT nextval('tyre_inspections_inspection_id_seq'::regclass),
  job_id integer,
  vehicle_id integer,
  axle_position text,
  brand text,
  size text,
  tread_depth numeric,
  pressure_psi numeric,
  measured_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'TYRE_API'::text,
  raw_payload jsonb,
  CONSTRAINT tyre_inspections_pkey PRIMARY KEY (inspection_id),
  CONSTRAINT tyre_inspections_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT tyre_inspections_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id)
);
CREATE TABLE public.user_signatures (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL UNIQUE,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_signatures_pkey PRIMARY KEY (id),
  CONSTRAINT user_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.users (
  user_id integer NOT NULL DEFAULT nextval('users_user_id_seq'::regclass),
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  role character varying NOT NULL,
  phone character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  dark_mode boolean DEFAULT false,
  job_title text,
  name text,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.vehicle_tracking_events (
  event_id bigint NOT NULL DEFAULT nextval('vehicle_tracking_events_event_id_seq'::regclass),
  vehicle_id integer,
  job_id integer,
  status text NOT NULL,
  location text,
  notes text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by integer,
  CONSTRAINT vehicle_tracking_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT vehicle_tracking_events_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(vehicle_id),
  CONSTRAINT vehicle_tracking_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT vehicle_tracking_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.vehicles (
  vehicle_id integer NOT NULL DEFAULT nextval('vehicles_vehicle_id_seq'::regclass),
  reg_number character varying NOT NULL UNIQUE,
  make character varying,
  model character varying,
  year integer,
  vin character varying,
  owner_id integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  colour text,
  engine_number text,
  mileage integer,
  fuel_type text,
  transmission text,
  body_style text,
  mot_due date,
  service_history text,
  warranty_type text,
  warranty_expiry date,
  insurance_provider text,
  insurance_policy_number text,
  customer_id uuid,
  registration text,
  make_model text,
  chassis text,
  engine text,
  lease_co text,
  privileges jsonb,
  service_plan_supplier text,
  service_plan_type text,
  service_plan_expiry date,
  engine_capacity integer,
  tax_status text,
  tax_due_date date,
  co2_emissions integer,
  marked_for_export boolean,
  wheelplan text,
  month_of_first_registration text,
  CONSTRAINT vehicles_pkey PRIMARY KEY (vehicle_id),
  CONSTRAINT vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.vhc_authorizations (
  id integer NOT NULL DEFAULT nextval('vhc_authorizations_id_seq'::regclass),
  job_id integer NOT NULL,
  authorized_by text NOT NULL,
  authorized_at timestamp with time zone NOT NULL DEFAULT now(),
  authorized_items jsonb DEFAULT '[]'::jsonb,
  customer_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vhc_authorizations_pkey PRIMARY KEY (id),
  CONSTRAINT vhc_authorizations_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.vhc_checks (
  vhc_id integer NOT NULL DEFAULT nextval('vhc_checks_vhc_id_seq'::regclass),
  job_id integer,
  section character varying,
  issue_title character varying,
  issue_description text,
  measurement character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vhc_checks_pkey PRIMARY KEY (vhc_id),
  CONSTRAINT vhc_checks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.vhc_declinations (
  id integer NOT NULL DEFAULT nextval('vhc_declinations_id_seq'::regclass),
  job_id integer NOT NULL,
  declined_by text NOT NULL,
  declined_at timestamp with time zone NOT NULL DEFAULT now(),
  customer_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vhc_declinations_pkey PRIMARY KEY (id),
  CONSTRAINT vhc_declinations_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.vhc_send_history (
  id integer NOT NULL DEFAULT nextval('vhc_send_history_id_seq'::regclass),
  job_id integer NOT NULL,
  sent_by text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  send_method text DEFAULT 'email'::text,
  customer_email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vhc_send_history_pkey PRIMARY KEY (id),
  CONSTRAINT vhc_send_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.workshop_consumable_budgets (
  budget_id bigint NOT NULL DEFAULT nextval('workshop_consumable_budgets_budget_id_seq'::regclass),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  monthly_budget numeric NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0::numeric),
  updated_by integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumable_budgets_pkey PRIMARY KEY (budget_id),
  CONSTRAINT workshop_consumable_budgets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.workshop_consumable_orders (
  order_id bigint NOT NULL DEFAULT nextval('workshop_consumable_orders_order_id_seq'::regclass),
  consumable_id uuid NOT NULL,
  order_date date NOT NULL DEFAULT now(),
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_value numeric DEFAULT ((quantity)::numeric * unit_cost),
  supplier text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumable_orders_pkey PRIMARY KEY (order_id),
  CONSTRAINT workshop_consumable_orders_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.workshop_consumables(id)
);
CREATE TABLE public.workshop_consumable_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  requested_by integer,
  requested_by_name text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumable_requests_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_consumable_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.workshop_consumable_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer NOT NULL,
  consumable_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0::numeric),
  total_cost numeric DEFAULT ((quantity)::numeric * unit_cost),
  used_by integer,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumable_usage_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_consumable_usage_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT workshop_consumable_usage_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.workshop_consumables(id),
  CONSTRAINT workshop_consumable_usage_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.workshop_consumables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  part_number text,
  supplier text,
  unit_cost numeric NOT NULL DEFAULT 0,
  estimated_quantity integer NOT NULL DEFAULT 0,
  last_order_date date,
  next_estimated_order_date date,
  last_order_quantity integer NOT NULL DEFAULT 0,
  last_order_total_value numeric,
  reorder_frequency_days integer DEFAULT 30,
  is_required boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumables_pkey PRIMARY KEY (id)
);