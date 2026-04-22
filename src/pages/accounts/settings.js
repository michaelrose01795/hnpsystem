// file location: src/pages/accounts/settings.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountsSettingsRedirectPageUi from "@/components/page-ui/accounts/accounts-settings-ui"; // Extracted presentation layer.

const SETTINGS_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

export default function AccountsSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const nextQuery = { ...router.query, settings: "1" };
    router.replace({ pathname: "/accounts", query: nextQuery });
  }, [router]);

  return <AccountsSettingsRedirectPageUi view="section1" ProtectedRoute={ProtectedRoute} SETTINGS_ROLES={SETTINGS_ROLES} />;




}
