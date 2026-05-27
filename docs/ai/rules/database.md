# database.md — Supabase, Schema, Queries

## Sources of Truth

- **Schema reference SQL:** `src/lib/database/schema/schemaReference.sql`
- **Prisma schema:** `prisma/schema.prisma` (Vehicle, Customer, JobCard, PartsRequest, TimeEntry, MotTest, Sale)
- **Supabase client:** `src/lib/database/supabaseClient.js`
- **DB helpers:** `src/lib/database/<domain>.js` (e.g. `jobs.js`, `hr.js`, `vehicles.js`, `messages.js`)

## Hard Rules

1. **Never** write raw Supabase queries in pages or components — add them to the matching helper in `src/lib/database/`.
2. **Never guess** column names, table names, FK relationships, or status / enum values. Read the schema first.
3. Before writing a new query, check whether the helper function already exists.
4. Match the **existing query style** in that helper file (select shape, filters, joins, error handling).

## Workflow for Any Data Change

1. Open the schema file and the relevant helper.
2. Confirm column / table / enum names.
3. If extending a helper, follow its return-shape convention.
4. State in the response: *DB schema checked? yes — verified table X, columns A, B, C.*

## Schema Changes — Stop & Confirm

Any change to the schema, migrations, or Prisma models requires explicit user approval. State the change, the affected tables, and the migration plan before applying.
