// file location: src/components/compliance/ComplianceLayout.js
// Shared shell for /admin/compliance/* pages: gates by role, places a tab
// nav, and leaves the content directly inside the main app page card.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { COMPLIANCE_ADMIN_ROLES } from "@/lib/compliance/roles";

const TABS = [
  { href: "/admin/compliance", label: "Dashboard" },
  { href: "/admin/compliance/sars", label: "Subject Requests" },
  { href: "/admin/compliance/breaches", label: "Breaches" },
  { href: "/admin/compliance/dpias", label: "DPIAs" },
  { href: "/admin/compliance/ropa", label: "ROPA" },
  { href: "/admin/compliance/retention", label: "Retention" },
];

const upper = (arr) => arr.map((role) => role.toUpperCase());

export default function ComplianceLayout({ title, children }) {
  const router = useRouter();
  const currentPath = router.pathname || "";

  return (
    <ProtectedRoute allowedRoles={upper(COMPLIANCE_ADMIN_ROLES)}>
      <Head>
        <title>{title ? `${title} - Compliance` : "Compliance"} - HNP System</title>
      </Head>
      <div className="app-page-stack" style={{ gap: 10 }}>
        <DevLayoutSection
          as="nav"
          sectionKey="admin-compliance-tabs"
          parentKey="app-layout-page-card"
          sectionType="tab-row"
          className="tab-api tab-api--wrap"
          aria-label="Compliance sections"
        >
          {TABS.map((tab) => {
            const active =
              tab.href === "/admin/compliance"
                ? currentPath === "/admin/compliance"
                : currentPath.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`tab-api__item${active ? " is-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </DevLayoutSection>
        {children}
      </div>
    </ProtectedRoute>
  );
}
