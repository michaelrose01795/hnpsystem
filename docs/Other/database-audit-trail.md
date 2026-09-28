# Database audit trail

Every create, update and delete on every applicable table is recorded in
`public.audit_events`. This is the same append-only, hash-chained table the
activity viewer (`/api/audit`) already reads. There is one audit store and no
feature writes its own.

Migration: `supabase/migrations/20260928120000_full_database_audit_trail.sql`
Rollback: `supabase/rollbacks/20260928120000_full_database_audit_trail_down.sql` (run by hand)

## What each event records

| Column | Meaning |
|---|---|
| `occurred_at` | Exact moment of the change (`timestamptz`, stored in UTC) |
| `table_name`, `record_type`, `record_id` | The affected record. Composite keys are joined with `:` |
| `operation` | `insert` / `update` / `delete` / `truncate` |
| `changed_fields` | Columns an update changed, or columns an insert populated |
| `before_data` / `after_data` | Update: only the changed columns. Insert: the new row. Delete: the old row |
| `actor_type` | `user`, `customer`, `system`, `anonymous` or `unattributed` |
| `actor_user_id`, `actor_name`, `actor_email`, `actor_role`, `actor_department` | Read from `users` by the database, never trusted from the request. Job title is in `metadata.actor_job_title` |
| `actor_auth_subject` | The login subject as presented: the user id today, the Keycloak `sub` later, or `customer:<uuid>` |
| `session_id`, `request_id`, `route`, `ip_address` | Links the change to the audit session, to the browser's `api_mutation` event and to the API route that made it |
| `feature` | Module (jobs, vhc, parts, hr, accounts …) |

Credentials, tokens and bank / card / NI identifiers are always stored as
`[REDACTED]`, but the fact that they changed still appears in
`changed_fields`. Values over 8 KB are replaced by their size and md5.

## How the actor is established

| Where the write comes from | Recorded as |
|---|---|
| API route behind `withRoleGuard` | The signed-in staff member (bound automatically) |
| API route wrapped in `withAuditRequest(handler)` | The signed-in staff member, or `anonymous` if there is none |
| `withAuditRequest(handler, { actor: "customer" })` | The website customer, or `anonymous` |
| `withAuditRequest(handler, { actor: "system" })` | `system`, with the route as its source (cron, webhooks) |
| Browser write with the anon key | The user who owns the audit session sent in `x-audit-session-id` |
| SQL editor, migrations, `pg_cron` | `system (database:…)` |
| Anything else | `unattributed`. It is never guessed onto a person |

The server binds the actor with `AsyncLocalStorage`
(`src/lib/audit/requestAuditContext.js`). The Supabase client forwards it as
`x-audit-*` headers on writes, and the trigger trusts those headers only on
service-role requests.

A SQL script acting on someone's behalf can say so:

```sql
select set_config('app.audit_actor_user_id', '42', true);
select set_config('app.audit_source', 'script:fix-invoice-totals', true);
```

**New API route that writes and is not behind `withRoleGuard`?** Wrap its
default export with `withAuditRequest`, otherwise its changes are recorded as
`unattributed`.

## Adding a table

Tables are not picked up automatically after this migration. In the migration
that creates the table:

```sql
select public.audit_enable_table('my_new_table');
-- options: p_record_type, p_module, p_capture_mode ('all' | 'mutations_only'),
--          p_redacted_columns, p_ignored_columns (default {updated_at})
```

Use `mutations_only` for tables that already are a history (status
histories, ledgers, event feeds), so only edits and deletes of that history are
audited. `select * from public.audit_coverage_report();` lists every table as
tracked, excluded (with reason), disabled, or **NOT COVERED**.

To stop auditing a table, call `select public.audit_disable_table('t', 'reason');`.
That change is audited as well.

## Reading a record's history

`GET /api/audit/record-history?recordType=jobs&recordId=123` (full audit
viewers only). It accepts a table name or a record type and spans live and
archived events. `?coverage=1` returns the coverage report. The existing activity
viewer's record-type / record-id filters also work for every audited table.

## Protection

Browser roles have no access to any audit table. The server can only insert and
read. An append-only trigger rejects update and delete for every role, including
the owner, except the archive job. Each row is hash-chained to the previous one.

## Existing history features

These stay as they are. They are business features, and the central trail
records the underlying changes:

- `writeAuditLog` / `audit_log`: already mirrored into `audit_events`
- `job_activity_events`, `*_status_history`, stock movements, tracking events:
  user-facing timelines, audited as `mutations_only`
- `activity_logs`: its DB helper is not used by any live code
