// file location: src/pages/vhc/customer-view/[jobNumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";

export default function VhcCustomerViewPage() {
  const router = useRouter();
  const { jobNumber, returnTo } = router.query;

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
          <button
            type="button"
            onClick={handleBack}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "8px 16px",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to workshop view
          </button>
          <div style={{ fontSize: "14px", color: "#9ca3af" }}>Read-only customer preview</div>
        </div>

        <VhcDetailsPanel jobNumber={jobNumber} showNavigation={false} readOnly />
      </div>
    </Layout>
  );
}
