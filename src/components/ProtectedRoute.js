// file location: /src/components/ProtectedRoute.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { hasDevPlatformPageAccess } from "@/lib/auth/devSession";
import { isAllAccessUser } from "@/lib/auth/allAccessSession";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { isRestorableRoute } from "@/lib/auth/returnRoute";

// Resolve, synchronously, whether the current auth state grants access. This
// mirrors the redirect effect's decision so the *render* never has to wait for a
// `checked` state flip — that flip used to add a second skeleton frame on top of
// Layout's pre-auth skeleton, which read as two separate loading phases. Returns
// one of: "loading" | "granted" | "denied". Security is unchanged: anything that
// isn't an explicit "granted" renders the skeleton (never the protected
// children), and the redirect side-effects still fire from the effect below.
function resolveAccess({ loading, status, user, session, allowedRoles }) {
  if (loading || status === "loading") return "loading";

  const roleHolder = user || (status === "authenticated" ? session?.user : null);
  if (roleHolder) {
    if (!allowedRoles) return "granted";
    if (hasDevPlatformPageAccess(roleHolder)) return "granted"; // dev-platform diagnostic account only
    if (isAllAccessUser(roleHolder)) return "granted"; // All Access demo login only
    const hasRole = (roleHolder.roles || []).some((r) =>
      allowedRoles.includes(String(r).toUpperCase())
    );
    return hasRole ? "granted" : "denied"; // denied → redirecting; show skeleton, not content
  }

  // No resolved user yet (e.g. unauthenticated, redirect pending) — keep the
  // skeleton up rather than flashing protected content.
  return "denied";
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, loading } = useUser();

  // Redirect side-effects only. Rendering is decided synchronously below so
  // authorized users don't see an extra skeleton frame waiting on state.
  useEffect(() => {
    if (isPresentationMode()) return;
    if (loading) return;
    // Dev-platform diagnostic account: granted above, so never redirect it.
    if (hasDevPlatformPageAccess(user) || hasDevPlatformPageAccess(session?.user)) return;
    // All Access demo login: granted above, so never redirect it either.
    if (isAllAccessUser(user) || isAllAccessUser(session?.user)) return;

    if (user) {
      if (allowedRoles) {
        const hasRole = (user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) router.replace("/unauthorized");
      }
      return;
    }

    if (status === "authenticated" && session?.user) {
      if (allowedRoles) {
        const hasRole = (session.user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) router.replace("/unauthorized");
      }
      return;
    }

    if (status === "unauthenticated") {
      // A session that expires while the tab is open (or is restored without a
      // valid cookie) used to land on a bare "/login", which threw the route
      // away before the login page could read it — the user came back at
      // /newsfeed. Carry it the same way the edge guard does.
      const current = router.asPath || "";
      router.replace(
        isRestorableRoute(current)
          ? `/login?redirectedFrom=${encodeURIComponent(current)}`
          : "/login"
      );
    }
  }, [loading, status, session, user, allowedRoles, router]);

  // Presentation mode bypasses gating (mock data, no real session).
  if (isPresentationMode()) return <>{children}</>;

  // Render the same PageSkeleton the rest of the app uses until access is
  // explicitly granted — no second loading phase, no protected-content flash.
  if (resolveAccess({ loading, status, user, session, allowedRoles }) !== "granted") {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
