// file location: src/components/compliance/ComplianceLayout.js
// Shared shell for /admin/compliance/* pages: gates by role, places a tab
// nav, and wraps the content in the canonical app-page-shell hierarchy.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { COMPLIANCE_ADMIN_ROLES } from "@/lib/compliance/roles";

const TABS = [
  { href: "/admin/compliance", label: "Dashboard" },
  { href: "/admin/compliance/sars", label: "Subject Requests" },
  { href: "/admin/compliance/breaches", label: "Breaches" },
  { href: "/admin/compliance/dpias", label: "DPIAs" },
  { href: "/admin/compliance/ropa", label: "ROPA" },
  { href: "/admin/compliance/retention", label: "Retention" },
];

const upper = (arr) => arr.map((r) => r.toUpperCase());

export default function ComplianceLayout({ title, children }) {
  const router = useRouter();
  const currentPath = router.pathname || "";
  return (
    <ProtectedRoute allowedRoles={upper(COMPLIANCE_ADMIN_ROLES)}>
      <Head>
        <title>{title ? `${title} · Compliance` : "Compliance"} · HNP System</title>
      </Head>
      <Layout>
        <div className="app-page-shell">
          <div className="app-page-card" style={{ padding: "8px 8px 32px" }}>
            <div className="app-page-stack">
              <nav
                aria-label="Compliance sections"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border)",
                }}
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
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--radius-xs, 6px)",
                        textDecoration: "none",
                        background: active ? "var(--accentMain)" : "transparent",
                        color: active ? "var(--onAccentText)" : "var(--text-primary)",
                        fontWeight: active ? 700 : 500,
                        border: active ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
              {children}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
