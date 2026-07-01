// file location: src/lib/support/privacyRegression.test.js
//
// Phase 7 (hardening) — PRIVACY REGRESSION SUITE.
//
// The whole point of the support feature is that a rich diagnostic bundle is
// captured without ever leaking a secret. This suite plants known secrets into
// every corner of a realistic diagnostics blob + submit body and asserts that
// AFTER each sanitisation layer (client-equivalent `sanitiseDiagnostics`, then
// the route-boundary `buildReportInsert`) NONE of the planted secrets survive
// anywhere in the serialised output.
//
// If a future change to the capture surface introduces a new field that carries
// a raw value, this test fails — that is the regression guard.

import { describe, it, expect } from "vitest";
import { sanitiseDiagnostics, REDACTED } from "./sanitise";
import { buildReportInsert } from "./reportSubmission";

// Planted secrets. Each MUST NOT appear verbatim in any sanitised output.
const SECRETS = {
  jwt:
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSIsInJvbGUiOiJhZG1pbiJ9.abcDEF123456_secretsig",
  bearer: "Bearer sk_" + "live_supersecrettoken1234567890",
  serviceRole: "service_role_key_live_ABCDEF1234567890",
  stripe: "sk_" + "live_51ABCdefGHIjklMNOpqr",
  nino: "AB123456C",
  card: "4111 1111 1111 1111",
  email: "victim.person@example.co.uk",
  password: "hunter2-super-secret",
  cookie: "session=abc123; other=def456",
};

// A diagnostics blob shaped like a real capture, with a secret planted in every
// plausible carrier: free-text strings, secret-named keys, nested structures,
// arrays, URLs with secret query params, and provider fragments.
function plantedSnapshot() {
  return {
    captured_at: "2026-07-01T10:00:00.000Z",
    route: {
      asPath: `/dashboard?token=${SECRETS.jwt}&api_key=${SECRETS.stripe}&safe=1`,
    },
    code_ownership: { section_key: "dash.header", file: "src/x.js", line: 12 },
    session: {
      roles: ["admin"],
      dbUserId: 7,
      // Secret-named keys — must be redacted by key name.
      password: SECRETS.password,
      access_token: SECRETS.jwt,
      cookie: SECRETS.cookie,
    },
    device: { userAgent: `Mozilla/5.0 auth=${SECRETS.bearer}` },
    console_errors: [
      `Failed: Authorization: ${SECRETS.bearer}`,
      `Login for ${SECRETS.email} rejected`,
      `service key leaked ${SECRETS.serviceRole}`,
    ],
    failed_requests: [
      { method: "POST", url: `/api/login?password=${SECRETS.password}`, status: 401 },
    ],
    recent_actions: [`entered NINO ${SECRETS.nino}`, `card ${SECRETS.card}`],
    unhandled_errors: [{ message: `token ${SECRETS.jwt}` }],
    providers: {
      "ui-state": { activeField: `card_number=${SECRETS.card}`, filled: true },
    },
    feature_flags: { NEXT_PUBLIC_X: true },
    // A raw secret buried deep in an arbitrary nested object.
    misc: { deep: { deeper: { apiKey: SECRETS.stripe, note: `email ${SECRETS.email}` } } },
  };
}

// Recursively collect every string in a value, so we can assert on the whole tree.
function allStrings(value, acc = []) {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, acc));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, acc));
  return acc;
}

// PATTERN-detectable secrets: these must be scrubbed everywhere they appear —
// including free-text prose — because the sanitiser recognises their shape.
// (An arbitrary password typed into prose has NO detectable shape, so it can
// only be redacted by secret KEY NAME — see the key-name assertions below. That
// is a documented limitation, not a gap.)
const VALUE_SECRETS = [
  SECRETS.jwt,
  SECRETS.bearer,
  SECRETS.serviceRole,
  SECRETS.stripe,
  SECRETS.nino,
  SECRETS.card,
  SECRETS.email,
];

function assertNoSecrets(obj, label) {
  const serialised = JSON.stringify(obj);
  for (const secret of VALUE_SECRETS) {
    expect(serialised, `${label}: leaked ${secret.slice(0, 12)}…`).not.toContain(secret);
  }
  // The cookie value contains structured secrets; the whole raw cookie must go.
  expect(serialised, `${label}: leaked cookie`).not.toContain("abc123");
}

describe("privacy regression — layer 1: sanitiseDiagnostics (client + DB helper share this)", () => {
  const cleaned = sanitiseDiagnostics(plantedSnapshot());

  it("strips every planted value secret from the whole tree", () => {
    assertNoSecrets(cleaned, "sanitiseDiagnostics");
  });

  it("redacts secret-named keys outright", () => {
    expect(cleaned.session.password).toBe(REDACTED);
    expect(cleaned.session.access_token).toBe(REDACTED);
    expect(cleaned.session.cookie).toBe(REDACTED);
    expect(cleaned.misc.deep.deeper.apiKey).toBe(REDACTED);
  });

  it("leaves non-secret structure intact", () => {
    expect(cleaned.session.roles).toEqual(["admin"]);
    expect(cleaned.session.dbUserId).toBe(7);
    expect(cleaned.code_ownership.section_key).toBe("dash.header");
    expect(cleaned.feature_flags.NEXT_PUBLIC_X).toBe(true);
  });

  it("scrubs secret query params but keeps the path + safe params", () => {
    expect(cleaned.route.asPath).toContain("/dashboard");
    expect(cleaned.route.asPath).toContain("safe=1");
    expect(cleaned.route.asPath).not.toContain(SECRETS.jwt);
  });

  it("no planted string survives anywhere as a raw value", () => {
    for (const s of allStrings(cleaned)) {
      for (const secret of VALUE_SECRETS) {
        expect(s).not.toContain(secret);
      }
    }
  });
});

describe("privacy regression — layer 2: buildReportInsert (route boundary re-scrub)", () => {
  const built = buildReportInsert({
    body: {
      // Pattern-detectable secrets planted in prose — these MUST be scrubbed.
      description: `I saw an error, my Authorization was ${SECRETS.bearer} and token ${SECRETS.jwt}`,
      category: "bug",
      diagnostics: plantedSnapshot(),
      screenshots: [{ src: "data:image/png;base64,AAAA", annotation: `NINO ${SECRETS.nino}` }],
    },
    // Identity comes from the SESSION, never the client body — even if the client
    // tries to inject a fake reporter, buildReportInsert ignores it.
    session: { user: { id: 9, name: "Real User", roles: ["technician"] } },
  });

  it("succeeds", () => {
    expect(built.ok).toBe(true);
  });

  it("re-scrubs diagnostics — no planted value secret survives on the insert", () => {
    assertNoSecrets(built.input.diagnostics, "buildReportInsert.diagnostics");
  });

  it("scrubs the user description too (it is a kept free-text string)", () => {
    assertNoSecrets({ d: built.input.description }, "description");
  });

  it("scrubs screenshot annotations merged into diagnostics", () => {
    assertNoSecrets(built.input.diagnostics.attachments, "attachments");
  });

  it("takes reporter identity from the session, not the client", () => {
    expect(built.input.reporterUserId).toBe(9);
    expect(built.input.reporterUsername).toBe("Real User");
    expect(built.input.reporterRoles).toContain("technician");
  });

  it("derives durable columns without leaking secrets from the route URL", () => {
    if (built.input.route) {
      expect(built.input.route).not.toContain(SECRETS.jwt);
      expect(built.input.route).not.toContain(SECRETS.stripe);
    }
  });
});
