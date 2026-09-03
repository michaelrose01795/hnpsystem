// file location: src/pages/dev/error-preview.js
//
// Developer Platform — "Error Experience". One page where every screen the
// in-app error experience can show is visible at once, and where each class of
// failure can be triggered for real.
//
// Why it exists: before this, seeing a recovery screen meant deliberately
// breaking something and then undoing it, and there was no way at all to compare
// the variants side by side or check the copy without a crash. Reviewing the
// error experience should not require causing an error.
//
// Three parts:
//   1. PREVIEWS  — every recovery screen rendered inline, no crash involved.
//                  These render the REAL components (SupportErrorRecovery with
//                  plans from resolveRecovery / buildPageErrorPlan), not
//                  lookalikes, so what you see here cannot drift from what
//                  production shows.
//   2. TRIGGERS  — cause each failure for real: a render crash caught by a
//                  section boundary, one that escapes to the route boundary, an
//                  uncaught runtime error, an unhandled rejection, a failing API
//                  call. Each is logged to support_error_events exactly as it
//                  would be in production.
//   3. CAPTURED  — the durable trail read back from /api/support/error-events,
//                  so the whole loop (trigger → log → persist → retrieve) can be
//                  confirmed end to end in one place.
//
// Preview actions are inert on purpose: clicking "Try Again" on a PREVIEW would
// navigate you away from the page you are reviewing. The TRIGGERS section is
// where the buttons really work.
//
// Gated to DEV_PLATFORM_ROLES like every other /dev page. Note that this list is
// broad (see the comment on DEV_PLATFORM_ROLES in src/lib/auth/roles.js) — this
// page shows no customer data and no secrets, only the app's own error UI.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  SupportErrorRecovery,
  SectionBoundary,
} from "@/components/support/SupportErrorBoundary";
import { buildPageErrorPlan } from "@/components/support/PageErrorScreen";
import {
  resolveRecovery,
  RECOVERY_LEVELS,
  RECOVERY_VARIANTS,
  RECOVERY_ACTIONS,
} from "@/lib/support/recoveryModel";
import { reportError, reportApiError } from "@/lib/notifications/report";
import { apiErrorFromResponse } from "@/lib/api/apiError";
import { logErrorEvent, ERROR_KINDS } from "@/lib/support/autoErrorLog";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

// A stale-chunk error — classifyError() treats this as unrecoverable, so the
// plan drops "Try again" and steers to a reload. Reproducing the real message
// is the point: the classification is what we want to preview.
const staleChunkError = () => {
  const err = new Error("Loading chunk 42 failed. (missing: /_next/static/chunks/42.js)");
  err.name = "ChunkLoadError";
  return err;
};

const genericError = () => new Error("Cannot read properties of undefined (reading 'jobNumber')");

// Preview handlers do nothing — see the header. Every action id maps to the same
// no-op so a curious click cannot navigate away mid-review.
const INERT_HANDLERS = Object.freeze(
  Object.values(RECOVERY_ACTIONS).reduce((acc, id) => ({ ...acc, [id]: () => {} }), {})
);

// Every recovery screen the system can produce, in the order they escalate.
const PREVIEWS = [
  {
    id: "section",
    title: "Section crash",
    note: "A panel or tab died. Compact, stays in place, the rest of the page still works. Wrapped by <SectionBoundary>.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.SECTION,
      variant: RECOVERY_VARIANTS.STAFF,
      error: genericError(),
      sectionLabel: "Parts",
    }),
    level: RECOVERY_LEVELS.SECTION,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "route",
    title: "Page crash",
    note: "A page died. The sidebar and topbar survive — this is the boundary added to _app.js, and the one most crashes now hit.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.ROUTE,
      variant: RECOVERY_VARIANTS.STAFF,
      error: genericError(),
    }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "app",
    title: "App shell crash",
    note: "The layout itself died, so the whole interface is gone. Last resort — this is the original app-shell boundary.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.APP,
      variant: RECOVERY_VARIANTS.STAFF,
      error: genericError(),
    }),
    level: RECOVERY_LEVELS.APP,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "loop",
    title: "Crash loop",
    note: "The same subtree has died repeatedly. 'Try again' is withdrawn because it demonstrably cannot help, and the user is steered to a heavier recovery plus a report.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.ROUTE,
      variant: RECOVERY_VARIANTS.STAFF,
      error: genericError(),
      loopDetected: true,
    }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "stale",
    title: "Stale bundle (deploy mid-session)",
    note: "A chunk went missing because the app was redeployed while the user was in it. Retry is useless here; only a reload can fix it.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.ROUTE,
      variant: RECOVERY_VARIANTS.STAFF,
      error: staleChunkError(),
    }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "customer",
    title: "Customer surface",
    note: "Softer copy, a public 'home' target, and NO technical detail — used on /website and the customer VHC links.",
    plan: resolveRecovery({
      level: RECOVERY_LEVELS.ROUTE,
      variant: RECOVERY_VARIANTS.CUSTOMER,
      error: genericError(),
    }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.CUSTOMER,
  },
  {
    id: "404",
    title: "404 — page not found",
    note: "What /some-bad-url now renders instead of the stock white Next.js screen. Not retryable: the route genuinely does not exist.",
    plan: buildPageErrorPlan({ statusCode: 404 }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "500",
    title: "500 — server error",
    note: "Server-rendered failures and anything else Next.js escalates to the error page.",
    plan: buildPageErrorPlan({ statusCode: 500 }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
  {
    id: "403",
    title: "403 — no access",
    note: "A permission failure that reached the page level rather than a toast.",
    plan: buildPageErrorPlan({ statusCode: 403 }),
    level: RECOVERY_LEVELS.ROUTE,
    variant: RECOVERY_VARIANTS.STAFF,
  },
];

// A component that throws on render, on demand. Used by both crash triggers.
function Exploder({ armed, label }) {
  if (armed) throw new Error(`Deliberate ${label} crash from /dev/error-preview`);
  return (
    <p>
      Nothing is wrong here yet. Arm the crash above and this subtree will throw on its next
      render.
    </p>
  );
}

function ErrorPreviewPage() {
  // Two independent arm switches so a section crash and a page crash can be
  // demonstrated separately.
  const [sectionArmed, setSectionArmed] = React.useState(false);
  const [routeArmed, setRouteArmed] = React.useState(false);

  const [events, setEvents] = React.useState(null);
  const [eventsError, setEventsError] = React.useState(null);
  const [loadingEvents, setLoadingEvents] = React.useState(false);

  const loadEvents = React.useCallback(async () => {
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const res = await fetch("/api/support/error-events?limit=25");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 403 here means the signed-in roles fail hasDevPlatformAccess; a 500
        // almost always means the migration has not been applied yet.
        setEventsError(payload?.message || `Request failed (${res.status})`);
        setEvents(null);
        return;
      }
      setEvents(payload.data || []);
    } catch (err) {
      setEventsError(err?.message || "Could not reach the endpoint.");
      setEvents(null);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // --- triggers -------------------------------------------------------------

  const triggerRuntime = () => {
    // Thrown from a timeout so it escapes React entirely and reaches
    // window.onerror — the path an event-handler bug takes in the wild.
    setTimeout(() => {
      throw new Error("Deliberate uncaught runtime error from /dev/error-preview");
    }, 0);
  };

  const triggerRejection = () => {
    Promise.reject(new Error("Deliberate unhandled rejection from /dev/error-preview"));
  };

  const triggerApiError = async () => {
    // A real failing request, mapped through the real API choke point, so the
    // toast, the reference code and the logged event all come from production
    // code paths rather than a fabricated error object.
    try {
      const res = await fetch("/api/support/does-not-exist");
      throw apiErrorFromResponse(res, await res.json().catch(() => ({})));
    } catch (err) {
      reportApiError(err, { endpoint: "/api/support/does-not-exist", source: "error-preview" });
    }
  };

  const triggerDataLoadError = () => {
    reportError("LOAD_FAILED", new Error("Deliberate data-load failure"), {
      source: "data-load",
      endpoint: "/api/jobs/example",
    });
  };

  const triggerPermissionError = () => {
    const err = new Error("Deliberate permission failure");
    err.status = 403;
    reportError("PERMISSION", err, { source: "error-preview" });
  };

  const triggerDirectLog = () => {
    const ref = logErrorEvent({
      kind: ERROR_KINDS.OTHER,
      message: "Deliberate direct capture from /dev/error-preview",
      context: { source: "error-preview", manual: true },
    });
    reportError(
      ref
        ? "Logged a capture event. Refresh the captured list below to see it."
        : "Suppressed — an identical event was logged in the last 60 seconds.",
      null,
      { source: "error-preview", allowDuplicate: true }
    );
  };

  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Error Experience — Developer Platform</title>
      </Head>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>
        {/* ---------------------------------------------------------------- */}
        {/* 1. Previews                                                       */}
        {/* ---------------------------------------------------------------- */}
        <LayerSurface>
          <h1 style={{ margin: 0, color: "var(--accentText)" }}>Error experience</h1>
          <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.75, lineHeight: 1.5 }}>
            Every screen the in-app error experience can show, rendered live — no crash required.
            These are the real components with real recovery plans, so nothing here can drift from
            what production shows. Buttons in this section are deliberately inert; use{" "}
            <strong>Trigger a real error</strong> below to exercise them for real.
          </p>
          <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.6, fontSize: "var(--text-caption)" }}>
            The &ldquo;Technical details&rdquo; panel appears only for roles that pass{" "}
            <code>canViewDiagnostics</code>. If you can see it, your account is one of them.
          </p>
        </LayerSurface>

        {PREVIEWS.map((preview) => (
          <LayerSurface key={preview.id}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-1)" }}>{preview.title}</h2>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--text-1)",
                  opacity: 0.7,
                  lineHeight: 1.5,
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {preview.note}
              </p>
            </div>
            {/* The recovery screen sits on a theme layer so it reads as a
                specimen inside the page rather than as the page's own error. */}
            <LayerTheme>
              <SupportErrorRecovery
                plan={preview.plan}
                error={genericError()}
                referenceCode="ERR-PREVIEW"
                level={preview.level}
                variant={preview.variant}
                handlers={INERT_HANDLERS}
              />
            </LayerTheme>
          </LayerSurface>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* 2. Triggers                                                       */}
        {/* ---------------------------------------------------------------- */}
        <LayerSurface>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)" }}>Trigger a real error</h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--text-1)",
                opacity: 0.7,
                lineHeight: 1.5,
                fontSize: "var(--text-body-sm)",
              }}
            >
              These cause genuine failures and are logged to <code>support_error_events</code>{" "}
              exactly as they would be in production. Refresh the captured list below afterwards to
              confirm the whole loop.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <button type="button" className="app-btn app-btn--secondary" onClick={triggerRuntime}>
              Uncaught runtime error
            </button>
            <button type="button" className="app-btn app-btn--secondary" onClick={triggerRejection}>
              Unhandled rejection
            </button>
            <button type="button" className="app-btn app-btn--secondary" onClick={triggerApiError}>
              Failing API request
            </button>
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={triggerDataLoadError}
            >
              Data-load failure
            </button>
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={triggerPermissionError}
            >
              Permission denied
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={triggerDirectLog}>
              Log a capture event directly
            </button>
          </div>

          <p
            style={{
              margin: 0,
              color: "var(--text-1)",
              opacity: 0.7,
              lineHeight: 1.5,
              fontSize: "var(--text-body-sm)",
            }}
          >
            The five buttons above produce a toast or nothing visible — that is correct. A toast
            carries the friendly sentence plus a reference code; the technical detail goes to the
            log, never to the screen.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link href="/this-route-does-not-exist" className="app-btn app-btn--secondary">
              Visit a 404
            </Link>
            <Link href="/unauthorized" className="app-btn app-btn--ghost">
              Visit /unauthorized
            </Link>
          </div>
        </LayerSurface>

        {/* Real render crashes. Each is wrapped so the failure is contained to
            its own card and this page stays usable while you look at it. */}
        <LayerSurface>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)" }}>Real render crash (section)</h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--text-1)",
                opacity: 0.7,
                lineHeight: 1.5,
                fontSize: "var(--text-body-sm)",
              }}
            >
              Arm this and the subtree below throws on its next render. A{" "}
              <code>&lt;SectionBoundary&gt;</code> catches it in place — everything else on this
              page keeps working. Press Retry on the recovery screen to bring it back (disarm
              first, or it will simply crash again and demonstrate the crash-loop screen).
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => setSectionArmed(true)}
            >
              Arm section crash
            </button>
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={() => setSectionArmed(false)}
            >
              Disarm
            </button>
          </div>
          <LayerTheme>
            <SectionBoundary sectionLabel="Error preview specimen" sectionKey="dev-error-preview">
              <Exploder armed={sectionArmed} label="section" />
            </SectionBoundary>
          </LayerTheme>
        </LayerSurface>

        <LayerSurface>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)" }}>Real render crash (whole page)</h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--text-1)",
                opacity: 0.7,
                lineHeight: 1.5,
                fontSize: "var(--text-body-sm)",
              }}
            >
              This one is NOT wrapped locally, so it escapes to the route boundary in{" "}
              <code>_app.js</code> and replaces this page. Watch what survives: the sidebar and
              topbar stay up. Navigating anywhere else clears it.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--text-1)",
                opacity: 0.7,
                lineHeight: 1.5,
                fontSize: "var(--text-body-sm)",
              }}
            >
              In development the Next.js overlay appears first — that is deliberate and unchanged.
              Dismiss it to see the H&amp;P screen underneath, or run a production build to see
              what staff actually get.
            </p>
          </div>
          <button
            type="button"
            className="app-btn app-btn--danger"
            onClick={() => setRouteArmed(true)}
          >
            Crash this page
          </button>
          <Exploder armed={routeArmed} label="route" />
        </LayerSurface>

        {/* ---------------------------------------------------------------- */}
        {/* 3. Captured trail                                                 */}
        {/* ---------------------------------------------------------------- */}
        <LayerSurface>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-1)" }}>Captured automatically</h2>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--text-1)",
                  opacity: 0.7,
                  lineHeight: 1.5,
                  fontSize: "var(--text-body-sm)",
                }}
              >
                Read back from <code>support_error_events</code>. Everything here was logged without
                anyone pressing &ldquo;Report Problem&rdquo;.
              </p>
            </div>
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={loadEvents}
              disabled={loadingEvents}
            >
              {loadingEvents ? "Loading…" : "Refresh"}
            </button>
          </div>

          {eventsError && (
            <LayerTheme>
              <p style={{ margin: 0, color: "var(--text-1)", lineHeight: 1.5 }}>
                <strong>Could not read the trail:</strong> {eventsError}
              </p>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-1)",
                  opacity: 0.7,
                  lineHeight: 1.5,
                  fontSize: "var(--text-body-sm)",
                }}
              >
                A 500 here almost always means the migration has not been applied yet — run{" "}
                <code>supabase/migrations/20260902120000_support_error_events.sql</code>. Capture
                degrades silently without it: the screens above all still work, but nothing is
                stored.
              </p>
            </LayerTheme>
          )}

          {!eventsError && events && events.length === 0 && (
            <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7, lineHeight: 1.5 }}>
              Nothing captured yet. Trigger something above, then refresh.
            </p>
          )}

          {!eventsError && events && events.length > 0 && (
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table className="app-data-table app-data-table--compact">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Kind</th>
                    <th>Message</th>
                    <th>Route</th>
                    <th>Seen</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.reference_code || "—"}</td>
                      <td>{event.kind}</td>
                      <td>{event.message || "—"}</td>
                      <td>{event.route || "—"}</td>
                      <td>{event.occurrences}</td>
                      <td>
                        {event.last_seen_at
                          ? new Date(event.last_seen_at).toLocaleTimeString("en-GB")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LayerSurface>
      </div>
    </ProtectedRoute>
  );
}

export default ErrorPreviewPage;

ErrorPreviewPage.getLayout = withDevPlatformLayout({ activeKey: "error-preview" });
