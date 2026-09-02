// file location: src/components/support/PageErrorScreen.js
//
// The in-app error experience for FRAMEWORK-level page errors — the ones a React
// error boundary can never catch because they happen before or outside the React
// tree the boundary guards:
//
//   • a 404 (no such route)                       → src/pages/404.js
//   • a 500 (server-rendered failure)             → src/pages/500.js
//   • any other server/client error Next.js       → src/pages/_error.js
//     hands to the error page
//
// Without these pages Next.js renders its own stock white "404 | This page could
// not be found" / "Internal Server Error" screen, which is the one place raw
// framework output still reached staff in production. This screen replaces that
// with the same H&P recovery UI the error boundary shows.
//
// It is deliberately NOT a second design: it renders <SupportErrorRecovery>, the
// same component the boundary uses, and only supplies its own recovery `plan`
// (headline / message / actions) because there is no thrown error to classify.
// Surface, tokens, button family, reference-code line and the role-gated
// technical panel are all inherited unchanged.
//
// Development overlays are untouched: Next.js only routes to these pages for
// real 404/500 responses. In development a thrown render error still shows the
// Next.js dev overlay first, which is what a developer needs — see
// src/pages/_error.js for the detail.

import React from "react";
import { useRouter } from "next/router";
import { useSupportReport } from "@/context/SupportReportContext";
import { SupportErrorRecovery } from "@/components/support/SupportErrorBoundary";
import {
  RECOVERY_ACTIONS,
  RECOVERY_LEVELS,
  RECOVERY_VARIANTS,
  labelFor,
} from "@/lib/support/recoveryModel";
import { generateReferenceCode } from "@/lib/notifications/buildErrorAlert";
import { logErrorEvent, ERROR_KINDS } from "@/lib/support/autoErrorLog";

// Copy per situation. Plain English, no status codes in the headline — the code
// itself is developer detail and rides in the technical panel / the log.
export function describe(statusCode) {
  if (statusCode === 404) {
    return {
      headline: "We couldn't find that page",
      message:
        "The link may be out of date, or the page may have moved. Head back to the newsfeed and try again from there.",
      // A 404 is not retryable: the route genuinely does not exist, so offering
      // "Try again" would just reproduce it.
      retryable: false,
    };
  }
  if (statusCode === 403 || statusCode === 401) {
    return {
      headline: "You don't have access to that page",
      message:
        "Your account doesn't have permission for this area. If you think it should, send us a report and we'll check it.",
      retryable: false,
    };
  }
  if (statusCode === 500) {
    return {
      headline: "The server ran into a problem",
      message:
        "Something failed while loading this page. Trying again often clears it — if it doesn't, please send us a report.",
      retryable: true,
    };
  }
  return {
    headline: "This page hit an unexpected error",
    message:
      "You can try again, or head back to the newsfeed. If it keeps happening, please send us a report so we can look into it.",
    retryable: true,
  };
}

/**
 * Build the recovery plan for a framework page error — the same shape
 * resolveRecovery() returns for a caught crash, but derived from an HTTP status
 * instead of a thrown error.
 *
 * Exported so /dev/error-preview can render the REAL 404/500 screens rather than
 * a hand-copied lookalike that would silently drift from this one.
 *
 * @param {{ statusCode?: number, variant?: string, homeHref?: string }} [args]
 * @returns {object} a recovery plan for <SupportErrorRecovery plan={…}>
 */
export function buildPageErrorPlan({
  statusCode = 500,
  variant = RECOVERY_VARIANTS.STAFF,
  homeHref,
} = {}) {
  const { headline, message, retryable } = describe(statusCode);

  // The action set, in the order the user should consider them. Report is always
  // last and always ghost — matching resolveRecovery()'s tone rules.
  const ids = [
    ...(retryable ? [RECOVERY_ACTIONS.RETRY] : []),
    RECOVERY_ACTIONS.BACK,
    RECOVERY_ACTIONS.HOME,
    RECOVERY_ACTIONS.REPORT,
  ];
  const primaryId = ids[0];

  return {
    recoverable: retryable,
    loop: false,
    headline,
    message,
    primaryActionId: primaryId,
    // Labels come from the shared resolver, so a page error and a caught crash
    // never disagree about what the same button is called.
    actions: ids.map((id) => ({
      id,
      label: labelFor(id, { level: RECOVERY_LEVELS.ROUTE, variant }),
      tone:
        id === RECOVERY_ACTIONS.REPORT ? "ghost" : id === primaryId ? "primary" : "secondary",
    })),
    homeHref: homeHref || (variant === RECOVERY_VARIANTS.CUSTOMER ? "/" : "/newsfeed"),
    // The technical panel stays staff-only, and inside that is further gated to
    // diagnostic roles by SupportErrorRecovery itself.
    allowDiagnostics: variant === RECOVERY_VARIANTS.STAFF,
  };
}

/**
 * @param {object} props
 * @param {number} [props.statusCode]  The HTTP status Next.js reported.
 * @param {string} [props.variant]     "staff" (default) or "customer".
 * @param {string} [props.homeHref]    Where "Return to Newsfeed" goes.
 * @param {unknown} [props.error]      The error Next.js passed, when it has one.
 */
export default function PageErrorScreen({
  statusCode = 500,
  variant = RECOVERY_VARIANTS.STAFF,
  homeHref,
  error = null,
}) {
  const router = useRouter();
  const { openSupportReport } = useSupportReport();
  const home = homeHref || (variant === RECOVERY_VARIANTS.CUSTOMER ? "/" : "/newsfeed");

  // One reference code per mount, minted the same way the boundary and the error
  // toasts mint theirs — so a staff member quoting it is traceable against the
  // automatically-logged event below.
  const referenceCodeRef = React.useRef(null);
  if (referenceCodeRef.current === null) referenceCodeRef.current = generateReferenceCode();
  const referenceCode = referenceCodeRef.current;

  // Log the page error AUTOMATICALLY, exactly as a caught crash is logged —
  // the user does not have to press "Report a problem" for this to be recorded.
  // Runs once per mount; StrictMode's double-invoke is absorbed by the
  // fingerprint de-duplication inside logErrorEvent.
  React.useEffect(() => {
    logErrorEvent({
      kind: ERROR_KINDS.PAGE,
      error,
      message: error?.message || `${statusCode} page error`,
      referenceCode,
      statusCode,
      variant,
      context: { source: "page-error", statusCode },
    });
  }, [error, referenceCode, statusCode, variant]);

  const handlers = React.useMemo(
    () => ({
      [RECOVERY_ACTIONS.RETRY]: () => router.replace(router.asPath),
      [RECOVERY_ACTIONS.RELOAD]: () => {
        if (typeof window !== "undefined") window.location.reload();
      },
      [RECOVERY_ACTIONS.BACK]: () => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(home);
      },
      [RECOVERY_ACTIONS.HOME]: () => router.push(home),
      [RECOVERY_ACTIONS.REPORT]: () =>
        openSupportReport({
          prefill: {
            category: "bug",
            title: `${statusCode} on ${router?.asPath || "an unknown route"}`.slice(0, 300),
            description: [
              `I hit a ${statusCode} error on this page.`,
              "",
              `Reference: ${referenceCode}`,
              "",
              "A private technical snapshot is attached automatically.",
            ].join("\n"),
            referenceCode,
          },
        }),
    }),
    [router, home, openSupportReport, statusCode, referenceCode]
  );

  const plan = buildPageErrorPlan({ statusCode, variant, homeHref: home });

  return (
    <SupportErrorRecovery
      plan={plan}
      error={error}
      referenceCode={referenceCode}
      level={RECOVERY_LEVELS.ROUTE}
      variant={variant}
      homeHref={home}
      handlers={handlers}
      // These pages render outside the staff chrome in the 500/SSR case, so this
      // screen hosts the report popup itself rather than relying on StaffTopbar.
      hostSupportModal
    />
  );
}
