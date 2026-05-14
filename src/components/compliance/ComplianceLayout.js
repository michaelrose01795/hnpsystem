// file location: src/components/compliance/ComplianceLayout.js
// Shared shell for /admin/compliance/* pages: gates by role, places a tab
// nav, and leaves the content directly inside the main app page card.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabRow } from "@/components/ui/layout-system";
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
      <div className="app-page-stack">
        <TabRow
          sectionKey="admin-compliance-tabs"
          parentKey="app-layout-page-card"
          style={{ width: "fit-content", maxWidth: "100%" }}
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
                className={`app-tab app-tab--page${active ? " is-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </TabRow>
        {children}
      </div>
    </ProtectedRoute>
  );
}
