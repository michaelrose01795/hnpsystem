# HNP System — Testing & Verification

## Quick start

```bash
# Install Playwright browsers (one-time)
npx playwright install chromium

# Run all tests
npm run verify

# Or run individual suites
npm run test:smoke       # Pages load, APIs respond
npm run test:workflows   # Linked data flow tests
npm run test:visual      # Screenshot comparisons

# View the HTML report
npm run test:report
```

## Test structure

```
e2e/
├── auth.setup.js              # Logs in via dev credentials, saves session
├── helpers/
│   ├── db.js                  # Supabase service client + query helpers
│   ├── fixtures.js            # Extended Playwright fixtures (db, openJobCard)
│   └── test-data.js           # Test data factories (customers, vehicles, VHC items)
├── smoke/
│   ├── app-loads.spec.js      # Key pages load without errors
│   ├── navigation.spec.js     # Sidebar/nav renders correctly
│   └── api-health.spec.js     # API endpoints respond (not 500)
├── workflows/
│   ├── job-card-linked-flow.spec.js   # Job → requests → VHC → status history
│   ├── job-parts-linked.spec.js       # Job → VHC → parts pipeline
│   └── vhc-authorization-flow.spec.js # VHC pending → authorized/declined
├── visual/
│   └── key-pages.spec.js     # Screenshot baselines for login, dashboard, job list
└── .auth/
    └── user.json              # Saved auth state (gitignored)
```

## How linked workflow tests work

Linked tests verify that **data entered in one place appears correctly in related places**:

1. **DB-first setup**: Tests create data directly via Supabase service client (bypassing UI for speed and reliability).
2. **Cross-table assertions**: After inserting into `jobs`, the test verifies linked records in `job_requests`, `vhc_checks`, `parts_job_items`, `job_status_history`.
3. **UI verification**: After DB setup, tests navigate to the job card page and verify the linked data renders.
4. **Cleanup**: Each test suite deletes its test data (`TEST-` prefixed job numbers) in `afterAll`.

### Adding a new linked test

```js
import { test, expect } from '../helpers/fixtures.js';

test.describe('My new linked flow', () => {
  const jobNumber = `TEST-MY-FLOW-${Date.now()}`;
  let jobId;

  test.afterAll(async () => {
    const { db } = await import('../helpers/db.js');
    await db.from('jobs').delete().eq('id', jobId);
  });

  test('create and verify', async ({ db, page, openJobCard }) => {
    const job = await db.createTestJob({ job_number: jobNumber });
    jobId = job.id;

    // Add linked data...
    // Assert DB state...
    // Check UI...
    await openJobCard(jobNumber);
    await expect(page.locator('body')).toContainText(jobNumber);
  });
});
```

## The verify command

`npm run verify` runs this sequence:

1. **Lint** — `npm run lint` (non-blocking)
2. **Smoke tests** — page loads, API health (blocking)
3. **Workflow tests** — linked data flows (blocking)
4. **Visual tests** — screenshot comparison (non-blocking)

If a blocking step fails, verification stops. Results are summarised at the end.

## Database workflow

### Schema changes

All schema changes must go through migrations:

```bash
# 1. Create a timestamped migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# 2. Write the SQL (ALTER TABLE, CREATE TABLE, etc.)

# 3. Run it against Supabase
#    Option A: Supabase CLI (if local Supabase is running)
#    supabase db push
#    Option B: Run in Supabase Dashboard SQL Editor

# 4. Update the schema reference
#    src/lib/database/schema/schemaReference.sql
```

### Seed data

```bash
# Seed test data (users, customers, vehicles, sample job)
npm run db:seed
```

The seed script runs `supabase/seed/test-seed.sql`. It uses `ON CONFLICT DO NOTHING` so it is safe to re-run.

### Test data conventions

- All test job numbers start with `TEST-` (auto-cleaned after tests)
- Seed job numbers start with `SEED-` (stable, not cleaned by tests)
- Test customer/vehicle IDs use deterministic UUIDs (`00000000-...`)

## How future prompts should update code + DB + tests together

When making changes that touch both code and database:

1. **Schema change**: Create a migration in `supabase/migrations/`
2. **Update schema reference**: Reflect the change in `src/lib/database/schema/schemaReference.sql`
3. **Update seed data**: If new required fields, update `supabase/seed/test-seed.sql`
4. **Update test helpers**: If new tables/columns, add query helpers in `e2e/helpers/db.js`
5. **Add/update tests**: Add workflow tests for any new linked data flows
6. **Run verify**: `npm run verify` to confirm nothing is broken

## Environment requirements

Tests need these env vars (already in `.env` / `.env.local`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (test DB helpers) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth secret |

## Updating visual baselines

When intentional UI changes are made:

```bash
npx playwright test --project=visual --update-snapshots
```

This regenerates the screenshot baselines stored alongside the test files.
