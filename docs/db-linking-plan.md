# Database Linking Plan

This document enumerates every TODO that still needs a real database/API link, maps it to the appropriate helper in `src/lib`, and documents the extra schema needed to back those links.

## 1. TODOs That Need Database Wiring

| File & line | TODO summary | Link to `src/lib` | Tables involved / notes |
| --- | --- | --- | --- |
| `src/pages/hr/attendance.js:7` | Replace mock attendance, overtime, absence data | Use `getTodayClockingRecords`, `getAllClockingRecords` from `src/lib/database/clocking.js` plus new helpers `getAbsenceRecords`, `getOvertimeSummaries` inside a new `src/lib/database/hr.js` | Needs `time_records`, `hr_absences`, `overtime_sessions`, `overtime_periods` |
| `src/components/HR/OvertimeEntriesEditor.js:7,112` | Persist overtime sessions via Supabase | Add `saveOvertimeSession`, `listOvertimeSessions` in `src/lib/database/hr.js` calling `overtime_sessions` | `overtime_sessions`, `overtime_periods` |
| `src/hooks/useHrData.js:21` | Replace mock HR hook with database fetches | New `src/lib/database/hr.js` aggregator that joins `time_records`, `hr_absences`, `hr_training_assignments`, `hr_payroll_runs`, `hr_disciplinary_cases`, etc.; expose a single `getHrDashboardSnapshot` used here | Tables listed in Section 2 |
| `src/pages/hr/index.js:8` | Replace dashboard mock data | Same `getHrDashboardSnapshot` helper; reuse selectors already mentioned | Same as above |
| `src/pages/hr/employees/index.js:8` | Connect employee directory/profile to live tables | Extend `src/lib/database/users.js` with `getEmployeesWithProfile()` joining `users`, `hr_employee_profiles`, `hr_training_assignments`, `hr_absences` | Needs new `hr_employee_profiles` |
| `src/pages/hr/reports.js:6,8` | Drive exports/metrics from Supabase analytics | Create SQL views (`vw_hr_attendance_summary`, `vw_hr_turnover`, etc.) and expose through `src/lib/database/hrReports.js` | Views built on `time_records`, `users`, `hr_absences`, `hr_payroll_runs` |
| `src/pages/hr/settings.js:6` | Persist HR policies, shift rules, access controls | Add `src/lib/database/hrSettings.js` hitting `hr_policy_documents`, `hr_shift_rules`, `hr_access_roles` tables | Requires those tables |
| `src/pages/hr/payroll.js:7` | Pull payroll/pay rise/overtime data | `src/lib/database/payroll.js` hitting `hr_payroll_runs`, `hr_payroll_adjustments`, `overtime_sessions` | Tables listed in Section 2 |
| `src/pages/hr/training.js:8` | Persist assigned courses and renewals | `src/lib/database/hrTraining.js` hitting `hr_training_courses`, `hr_training_assignments`, `hr_training_events` | Tables listed in Section 2 |
| `src/pages/hr/recruitment.js:6` | Link job listings/applicants/tasks | `src/lib/database/recruitment.js` -> `hr_recruitment_jobs`, `hr_applicants`, `hr_applicant_tasks` | Tables listed in Section 2 |
| `src/pages/hr/performance.js:7-8` | Replace placeholder performance data and connect scheduling/actions | `src/lib/database/performance.js` -> `hr_performance_reviews`, `hr_performance_goals`, `hr_action_items` | Tables listed in Section 2 |
| `src/pages/hr/disciplinary.js:6` | Back incident lists with real disciplinary cases | `src/lib/database/disciplinary.js` -> `hr_disciplinary_cases`, `hr_disciplinary_actions` | Tables listed in Section 2 |
| `src/lib/auth/roleGuard.js:16` | Swap placeholder guard for policy-aware version | Call `getUserRoles`/`getUserPermissions` from `src/lib/database/users.js` and enforce via Supabase Row Level Security; ensure `users` table has `role` + optional `permissions` JSONB | Already have `users` table; consider `user_roles` lookup table |
| `src/lib/hr/reminderTasks.js:6,27` | Replace console reminders with Supabase Edge Function / cron | Add `hr_reminder_tasks` table + job queue; schedule via Supabase cron, triggered from this module | Needs `hr_reminder_tasks` |
| `src/components/VHC/WheelsHubsModal.js:8` | Replace placeholder modal data with TYRE API | Use `src/lib/tyre/tyreAPI.js` (once wired) -> persists to `tyre_inspections` cache table | Needs `tyre_inspections` (new) or reuse `parts_catalog` for tyres |
| `src/components/VHC/TyresSection.js:7` | Replace placeholder tyre search | Same as above | Same as above |
| `src/lib/tyre/tyreAPI.js` (lines 5,24,43,62,76) | Replace placeholder data with live API | Implement fetch to `process.env.TYRE_API_URL` and persist via `supabase.from("tyre_inspections")` or `parts_catalog` | Requires `tyre_inspections` |
| `src/api/vehicles/manufacturing.js:40` | Need engine capacity, taxation info in DB | Extend `src/lib/database/vehicles.js` create/update methods to include new columns added below | Adds `engine_capacity`, `tax_status`, `tax_due_date`, `co2_emissions`, `marked_for_export`, `wheelplan`, `month_of_first_registration` in `vehicles` |
| `src/api/vehicles/maintenance-history.js:67-86` | Missing lease company, privileges, service plan, mileage tracking | Extend `vehicles` table (lease company, service plan fields) and `jobs` table (`mileage_at_service`); create optional `vehicle_privileges` table if you need per-user privileges | See SQL below |
| `src/pages/tracking/index.js:273,478` | Replace static tracking data and persist key updates | Hook UI to `src/lib/database/tracking.js` hitting `vehicle_tracking_events` + `key_tracking_events` | Tables listed in Section 2 |
| `src/pages/appointments/index.js:130` | Persist day notes for calendar | New `appointments_notes` table; expose through `src/lib/database/jobs.js` (`saveAppointmentNote`) | `appointments_notes` |
| `src/pages/appointments/index.js:266` | Persist technician daily capacity overrides | New `appointment_day_capacity` table + helpers in `src/lib/database/jobs.js` | `appointment_day_capacity` |
| `src/pages/tech/dashboard.js:60` | Link clocking record to job | Add `job_id` + `job_number` columns to `time_records` (FK to `jobs`); update `clockIn` helper to accept optional job context so dashboard can hydrate the active job | `time_records` (ALTER) |
| `src/pages/job-cards/myjobs/[jobNumber].js:219` | Implement notes system backed by DB | Reuse existing `job_notes` table through `src/lib/database/jobs.js` (`getJobNotes`, `addJobNote`) and expose to this page | Already in schema (no new table) |
| `src/pages/api/status/getCurrentStatus.js:17` & `update.js:20` | Replace placeholder DB connection | Replace mocks with calls to `src/lib/database/jobs.getDashboardData()` or `src/lib/database/vhc.js` depending on status; ensure these API routes import from lib instead of ad-hoc connections | Existing tables (`jobs`, `vhc_workflow_status`) |
| `src/pages/tracking/index.js:478` | Persist vehicle/key updates via API endpoint | Use `pages/api/tracking` hitting new tracking tables referenced above | `vehicle_tracking_events`, `key_tracking_events` |
| `src/pages/hr/payroll.js`, `training.js`, `recruitment.js`, `performance.js`, `disciplinary.js` (multiple lines) | Each needs Supabase-backed data per module | Covered collectively via new lib modules and tables in Section 2 |

## 2. New / Missing Tables and Columns

Below are ready-to-run SQL statements (PostgreSQL/Supabase) covering every gap surfaced by the TODOs. Apply ALTERs before CREATEs where both touch the same table.

```sql
-- Clocking & overtime -------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_records (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  job_number TEXT,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC(6,2),
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overtime_periods (
  period_id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  UNIQUE (period_start, period_end)
);

CREATE TABLE IF NOT EXISTS overtime_sessions (
  session_id BIGSERIAL PRIMARY KEY,
  period_id BIGINT REFERENCES overtime_periods(period_id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours NUMERIC(5,2) GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM (end_time - start_time))/3600)::NUMERIC(5,2)) STORED,
  approved_by INTEGER REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Absence & HR core --------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_absences (
  absence_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  approved_by INTEGER REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_employee_profiles (
  profile_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  department TEXT,
  job_title TEXT,
  employment_type TEXT,
  start_date DATE,
  manager_id INTEGER REFERENCES users(user_id),
  photo_url TEXT,
  emergency_contact JSONB,
  documents JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_policy_documents (
  policy_id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  file_url TEXT NOT NULL,
  version TEXT,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_by INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS hr_shift_rules (
  rule_id BIGSERIAL PRIMARY KEY,
  department TEXT,
  rule_name TEXT NOT NULL,
  details JSONB NOT NULL,
  effective_from DATE,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_access_roles (
  role_id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_reminder_tasks (
  reminder_id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Training -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_training_courses (
  course_id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  renewal_interval_months INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_training_assignments (
  assignment_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES hr_training_courses(course_id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(user_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned',
  completed_at TIMESTAMPTZ,
  certificate_url TEXT
);

CREATE TABLE IF NOT EXISTS hr_training_events (
  event_id BIGSERIAL PRIMARY KEY,
  course_id BIGINT REFERENCES hr_training_courses(course_id),
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  instructor TEXT,
  capacity INTEGER,
  notes TEXT
);

-- Payroll ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  payroll_id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  processed_at TIMESTAMPTZ,
  processed_by INTEGER REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS hr_payroll_adjustments (
  adjustment_id BIGSERIAL PRIMARY KEY,
  payroll_id BIGINT REFERENCES hr_payroll_runs(payroll_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recruitment ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_recruitment_jobs (
  job_id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_applicants (
  applicant_id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES hr_recruitment_jobs(job_id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_applicant_tasks (
  task_id BIGSERIAL PRIMARY KEY,
  applicant_id BIGINT REFERENCES hr_applicants(applicant_id) ON DELETE CASCADE,
  assignee_id INTEGER REFERENCES users(user_id),
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance & disciplinary -----------------------------------------------
CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  review_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(user_id),
  scheduled_at DATE,
  score JSONB,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_performance_goals (
  goal_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  progress NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hr_action_items (
  action_id BIGSERIAL PRIMARY KEY,
  review_id BIGINT REFERENCES hr_performance_reviews(review_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(user_id),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS hr_disciplinary_cases (
  case_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  incident_date DATE NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_disciplinary_actions (
  action_id BIGSERIAL PRIMARY KEY,
  case_id BIGINT REFERENCES hr_disciplinary_cases(case_id) ON DELETE CASCADE,
  action_date DATE,
  action_type TEXT,
  taken_by INTEGER REFERENCES users(user_id),
  notes TEXT
);

-- Appointments --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments_notes (
  note_id BIGSERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(appointment_id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  note_text TEXT NOT NULL,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_day_capacity (
  capacity_id BIGSERIAL PRIMARY KEY,
  day DATE UNIQUE NOT NULL,
  technicians_available INTEGER NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_tracking_events (
  event_id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id),
  status TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS key_tracking_events (
  key_event_id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
  job_id INTEGER REFERENCES jobs(id),
  action TEXT NOT NULL,
  performed_by INTEGER REFERENCES users(user_id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Tyre data -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tyre_inspections (
  inspection_id BIGSERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id),
  vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
  axle_position TEXT,
  brand TEXT,
  size TEXT,
  tread_depth NUMERIC(4,2),
  pressure_psi NUMERIC(5,2),
  measured_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'TYRE_API',
  raw_payload JSONB
);

-- Vehicle data extras -------------------------------------------------------
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS lease_co TEXT,
  ADD COLUMN IF NOT EXISTS privileges JSONB,
  ADD COLUMN IF NOT EXISTS service_plan_supplier TEXT,
  ADD COLUMN IF NOT EXISTS service_plan_type TEXT,
  ADD COLUMN IF NOT EXISTS service_plan_expiry DATE,
  ADD COLUMN IF NOT EXISTS warranty_expiry DATE,
  ADD COLUMN IF NOT EXISTS engine_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS tax_status TEXT,
  ADD COLUMN IF NOT EXISTS tax_due_date DATE,
  ADD COLUMN IF NOT EXISTS co2_emissions INTEGER,
  ADD COLUMN IF NOT EXISTS marked_for_export BOOLEAN,
  ADD COLUMN IF NOT EXISTS wheelplan TEXT,
  ADD COLUMN IF NOT EXISTS month_of_first_registration TEXT;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS mileage_at_service INTEGER;
```

## 3. Implementation Notes

1. **New lib modules**: colocate domain-specific helpers under `src/lib/database/`. Each module should import the shared Supabase client (`../supabaseClient`) and expose CRUD helpers consumed by the UI pages listed above.
2. **API routes**: prefer routing UI calls through `/api/...` endpoints that call the lib helpers, so browser components never embed Supabase service keys.
3. **RLS & role guard**: once tables exist, add Supabase Row Level Security policies tied to `users.role`. Update `src/lib/auth/roleGuard.js` to read role data from `src/lib/database/users.js` rather than hard-coded arrays.
4. **Migrations**: run the SQL in Section 2 inside your migration system (Supabase migration files or Prisma). Apply ALTER statements first to avoid duplicate-column errors.
5. **Backfill**: for existing mock data (attendance, absence, overtime) seed the new tables using a script so UI has immediate records after wiring.
