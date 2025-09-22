// file location: /src/components/ProtectedRoute.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUser } from "../context/UserContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, loading } = useUser();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    // ✅ Case 1: dev user exists
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

    // ✅ Case 2: fallback to next-auth session
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

    // ✅ Case 3: definitely no user
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [loading, status, session, user, allowedRoles, router]);

  // Show nothing until we’ve finished checking
  if (loading || status === "loading" || !checked) {
    return <p>Loading...</p>;
  }

  return <>{children}</>;
}
