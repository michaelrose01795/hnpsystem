// file location: src/pages/vhc/customer-view/[jobNumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";
import { useUser } from "@/context/UserContext";
import VhcCustomerViewPageUi from "@/components/page-ui/vhc/customer-view/vhc-customer-view-job-number-ui"; // Extracted presentation layer.

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];

export default function VhcCustomerViewPage() {
  const router = useRouter();
  const { jobNumber, returnTo } = router.query;
  const { user } = useUser();
  const isCustomer = user?.roles?.some((role) =>
  CUSTOMER_ROLE_ALLOWLIST.includes((role || "").toUpperCase())
  );

  const resolveReturnTarget = () => {
    if (typeof returnTo === "string" && returnTo.length > 0) {
      try {
        return decodeURIComponent(returnTo);
      } catch (_error) {
        return returnTo;
      }
    }
    return jobNumber ? `/job-cards/${jobNumber}?vhcPreview=1` : "/job-cards/view";
  };

  const handleBack = () => {
    const target = resolveReturnTarget();
    if (target) {
      router.push(target);
    }
  };

  return <VhcCustomerViewPageUi view="section1" handleBack={handleBack} isCustomer={isCustomer} jobNumber={jobNumber} VhcDetailsPanel={VhcDetailsPanel} />;









































}

VhcCustomerViewPage.getLayout = (page) => <Layout requiresLandscape>{page}</Layout>;
