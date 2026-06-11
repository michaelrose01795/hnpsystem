// file location: src/pages/website-manager.js
// Staff-side Website Manager page — route: /website-manager
//
// Access: Admin, Managers and Sales (plus Owner). Two guards apply:
//   1. PageAccessGuard in _app.js derives accessible routes from the sidebar
//      config — users without a matching role are bounced to /dashboard
//      before this renders.
//   2. ProtectedRoute below is the explicit page-level role check.
// The Website Manager (including the Analytics tab) is staff-only — analytics
// are never exposed on the public /website pages.
// NOTE: this list MUST stay in sync with the roles array on the Website
//       Manager entry in src/config/navigation.js (lower-cased there).
import React from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import WebsiteManager from "@/features/websiteManager/WebsiteManager";

// ProtectedRoute compares against UPPER-CASED user roles.
const WEBSITE_MANAGER_ROLES = [
  "OWNER",
  "ADMIN",
  "ADMIN MANAGER",
  "GENERAL MANAGER",
  "SALES",
];

export default function WebsiteManagerPage() {
  return (
    <ProtectedRoute allowedRoles={WEBSITE_MANAGER_ROLES}>
      <Head>
        <title>Website Manager · HNPSystem</title>
      </Head>
      <WebsiteManager />
    </ProtectedRoute>
  );
}
