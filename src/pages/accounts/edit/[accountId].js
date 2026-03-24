// file location: src/pages/accounts/edit/[accountId].js // route shim to open the accounts edit popup
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";

const EDIT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER"];

export default function EditAccountRouteShim() {
  const router = useRouter();
  const accountId = typeof router.query.accountId === "string" ? router.query.accountId : "";

  useEffect(() => {
    if (!router.isReady || !accountId) return;
    const nextQuery = { ...router.query, edit: accountId };
    delete nextQuery.accountId;
    router.replace({ pathname: "/accounts", query: nextQuery });
  }, [accountId, router, router.isReady, router.query]);

  return (
    <ProtectedRoute allowedRoles={EDIT_ROLES}>
      <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
        Opening account form…
      </div>
    </ProtectedRoute>
  );
}
