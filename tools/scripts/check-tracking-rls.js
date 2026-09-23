// file location: tools/scripts/check-tracking-rls.js
//
// Verifies that the tracking event tables are reachable by the application and
// NOT reachable directly from a browser.
//
// Run it before and after
// supabase/migrations/20260826120000_tracking_events_server_only.sql, and after
// the matching _down.sql, to prove the lockdown and the rollback both did what
// they claim.
//
//   node tools/scripts/check-tracking-rls.js
//
// It makes read-only requests only, asks for a single row, and never prints row
// contents — only whether access was granted. Two identities are probed against
// each table:
//
//   anon         the key that ships in every page. Must be DENIED after the
//                lockdown: nothing in the browser reads or writes these tables
//                any more (every caller goes through /api/tracking/* or
//                /api/status/*, which run under the service role).
//   service_role the identity every server-owned tracking API uses. Must stay
//                ALLOWED — if this fails, the application has lost tracking.
//
// An anon write probe is included because a table can be readable-denied while
// still accepting inserts, and a forged movement row is worse than a leaked one.
// The write is deliberately invalid (no required column), so even in the failure
// case it cannot create a real tracking event.

const fs = require("node:fs");
const path = require("node:path");

const TABLES = ["key_tracking_events", "vehicle_tracking_events"];

const loadEnv = () => {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) return;
      const [, key, rawValue] = match;
      if (process.env[key]) return;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    });
};

// A request can fail for two very different reasons, and only one of them means
// the table is closed. PostgREST reports a privilege failure as 401/403/404 (or
// SQLSTATE 42501 in the body); a request that gets PAST the privilege check and
// then trips a column constraint comes back 400 with a code such as 23502
// (not-null violation) — which means the write WAS permitted. Treating any 4xx
// as "denied" reported the anon insert path as closed while it was in fact wide
// open, so the classification is on the error code, not the status.
const PERMISSION_DENIED_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

const isPermissionDenied = (status, body) => {
  if (status === 401 || status === 403 || status === 404) return true;
  return PERMISSION_DENIED_CODES.has(body?.code);
};

const describe = (result) => {
  const bits = [`HTTP ${result.status}`];
  if (result.code) bits.push(result.code);
  if (result.rows !== null) {
    bits.push(result.rows > 0 ? `${result.rows} rows visible` : "0 rows visible");
  }
  if (result.contentRange) bits.push(`range ${result.contentRange}`);
  return `${result.allowed ? "ALLOWED" : "denied"} (${bits.join(", ")})`;
};

const probe = async ({ url, key, table, method }) => {
  const endpoint =
    method === "GET"
      ? `${url}/rest/v1/${table}?select=job_id&limit=1`
      : `${url}/rest/v1/${table}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    // Intentionally missing the NOT NULL action/status column, so an accepted
    // write still cannot produce a usable row.
    body: method === "POST" ? JSON.stringify({ job_id: null }) : undefined,
  });

  const body = await response.json().catch(() => null);
  const denied = isPermissionDenied(response.status, body);

  // Status alone is not enough on a SELECT. If the grant survives but RLS is
  // enabled with no policy, PostgREST answers 200 with an empty array — which
  // is a very different state from "anon can read the whole table", yet both
  // are 2xx. Report how many rows actually came back so the two can never be
  // confused again.
  const rows = Array.isArray(body) ? body.length : null;
  const contentRange = response.headers.get("content-range");

  return {
    status: response.status,
    code: body?.code || null,
    allowed: !denied,
    denied,
    rows,
    contentRange,
  };
};

const main = async () => {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exitCode = 1;
    return;
  }

  const failures = [];

  for (const table of TABLES) {
    const anonRead = await probe({ url, key: anonKey, table, method: "GET" });
    const anonWrite = await probe({ url, key: anonKey, table, method: "POST" });
    const serviceRead = await probe({ url, key: serviceKey, table, method: "GET" });

    console.log(`\npublic.${table}`);
    console.log(`  anon    SELECT  ${describe(anonRead)}`);
    console.log(`  anon    INSERT  ${describe(anonWrite)}`);
    console.log(`  service SELECT  ${serviceRead.allowed ? "allowed" : "DENIED"} (HTTP ${serviceRead.status})`);

    if (anonRead.allowed) {
      failures.push(
        anonRead.rows
          ? `${table}: readable with the public anon key — ${anonRead.rows} rows returned`
          : `${table}: still granted to anon (RLS returned 0 rows, but the SELECT privilege remains)`
      );
    }
    if (anonWrite.allowed) failures.push(`${table}: writable with the public anon key`);
    if (!serviceRead.allowed) failures.push(`${table}: NOT readable by the service role — tracking is broken`);
  }

  console.log("");
  if (failures.length) {
    failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    console.error(
      "\nIf the lockdown migration has not been applied yet, this is the expected 'before' state."
    );
    process.exitCode = 1;
    return;
  }

  console.log("PASS  Tracking event tables are server-only and reachable by the service role.");
};

main().catch((error) => {
  console.error("Tracking RLS probe failed to run", error);
  process.exitCode = 1;
});
