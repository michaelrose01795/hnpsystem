// file location: src/pages/vhc/customer-view/[jobNumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";
import { useUser } from "@/context/UserContext";

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

  return (
    <Layout>
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {!isCustomer ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                padding: "8px 16px",
                background: "var(--surface)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Back to workshop view
            </button>
          ) : null}
          <div style={{ fontSize: "14px", color: "var(--info)" }}>Customer authorisation view</div>
        </div>

        <VhcDetailsPanel jobNumber={jobNumber} showNavigation={false} viewMode="customer" />
      </div>
    </Layout>
  );
}
