// file location: /src/components/ProtectedRoute.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ProtectedRoute({ children, allowedRoles }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, loading } = useUser();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      if (allowedRoles) {
        const hasRole = (user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) router.replace("/unauthorized");
      }
      setChecked(true);
      return;
    }

    if (status === "authenticated" && session?.user) {
      if (allowedRoles) {
        const hasRole = (session.user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) router.replace("/unauthorized");
      }
      setChecked(true);
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [loading, status, session, user, allowedRoles, router]);

  // While auth is resolving, render the same PageSkeleton the rest of the app
  // uses. Layout's own pre-auth skeleton already covers the case where the
  // page hasn't mounted yet; this ensures the skeleton stays until role checks
  // also resolve, without a flash of empty content between Layout's skeleton
  // and the real page render.
  if (loading || status === "loading" || !checked) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
