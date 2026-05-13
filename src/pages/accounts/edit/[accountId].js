// file location: src/pages/accounts/edit/[accountId].js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import EditAccountRouteShimUi from "@/components/page-ui/accounts/edit/accounts-edit-account-id-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import RouterParamsOverride from "@/features/presentation/runtime/RouterParamsOverride";
import AccountsListPage from "@/pages/accounts/index";

const EDIT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER"];

export default function EditAccountRouteShim() {
  const router = useRouter();
  const accountId = typeof router.query.accountId === "string" ? router.query.accountId : "";
  const inPresentation = isPresentationMode();

  useEffect(() => {
    if (inPresentation) return;
    if (!router.isReady || !accountId) return;
    const nextQuery = { ...router.query, edit: accountId };
    delete nextQuery.accountId;
    router.replace({ pathname: "/accounts", query: nextQuery });
  }, [accountId, inPresentation, router, router.isReady, router.query]);

  if (inPresentation) {
    return (
      <RouterParamsOverride params={{ edit: accountId }} pathname="/accounts">
        <AccountsListPage />
      </RouterParamsOverride>
    );
  }

  return <EditAccountRouteShimUi view="section1" EDIT_ROLES={EDIT_ROLES} ProtectedRoute={ProtectedRoute} />;






}
