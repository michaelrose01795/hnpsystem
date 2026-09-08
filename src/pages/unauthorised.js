// file location: src/pages/unauthorised.js
//
// Shown when a signed-in user reaches a page their role does not cover. Both
// guards send them here: the client-side <ProtectedRoute> and the edge check in
// src/proxy.js, each carrying the route they were trying to open as ?from=.
//
// The old US-spelled /unauthorized path 308-redirects here (see the redirects
// block in next.config.mjs), so existing bookmarks and any un-migrated link
// keep working.
//
// This file holds the logic; src/components/page-ui/unauthorised-ui.js holds
// the presentation.

import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import UnauthorisedPageUi from "@/components/page-ui/unauthorised-ui"; // Extracted presentation layer.

const HOME_PATH = "/newsfeed";
const MAX_PATH_CHARS = 120;

// `from` arrives in the URL, so it is user-controlled. It is only ever rendered
// as plain text (never as an href), and this keeps it to something that plausibly
// IS one of our routes: an in-app absolute path, not a protocol-relative or
// external URL, and short enough not to blow the layout apart.
export function safeAttemptedPath(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed.length > MAX_PATH_CHARS ? `${trimmed.slice(0, MAX_PATH_CHARS)}…` : trimmed;
}

// Roles are stored upper-cased ("SERVICE MANAGER"); title-case them so the
// screen reads as a sentence rather than as a shout.
export function formatRoles(roles) {
  const list = (Array.isArray(roles) ? roles : [])
    .map((role) => String(role || "").trim())
    .filter(Boolean)
    .map((role) => role.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()));
  if (!list.length) return "No roles assigned yet";
  return list.join(", ");
}

export default function UnauthorisedPage() {
  const router = useRouter();
  const { user } = useUser();

  const attemptedPath = safeAttemptedPath(router?.query?.from);
  const signedInAs = user?.username || user?.email || "Not signed in";
  const accessSummary = formatRoles(user?.roles);

  const goHome = React.useCallback(() => {
    router.push(HOME_PATH);
  }, [router]);

  // Prefer real history so the user returns to where they actually came from;
  // fall back to the newsfeed on a cold load (a bookmark, or a direct hit).
  const goBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(HOME_PATH);
  }, [router]);

  // Seeds the shared Help & Diagnostics report so support gets the route and the
  // roles the user actually holds, without them having to type any of it.
  const reportPrefill = React.useMemo(
    () => ({
      category: "question",
      title: `Access request${attemptedPath ? `: ${attemptedPath}` : ""}`.slice(0, 300),
      description: [
        "I was blocked from a page I think I should be able to open.",
        "",
        `Page requested: ${attemptedPath || "not recorded"}`,
        `Signed in as: ${signedInAs}`,
        `Roles held: ${accessSummary}`,
        "",
        "A private technical snapshot is attached automatically.",
      ].join("\n"),
    }),
    [attemptedPath, signedInAs, accessSummary]
  );

  return (
    <>
      <Head>
        <title>Access denied - HNP System</title>
      </Head>
      <UnauthorisedPageUi
        view="section1"
        attemptedPath={attemptedPath}
        signedInAs={signedInAs}
        accessSummary={accessSummary}
        reportPrefill={reportPrefill}
        onGoBack={goBack}
        onGoHome={goHome}
        homeLabel="Return to the newsfeed"
      />
    </>
  );
}
