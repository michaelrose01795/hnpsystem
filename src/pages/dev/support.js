// file location: src/pages/dev/support.js
//
// Phase 11 — the Support hub page. Groups the support-related developer areas
// into top-left in-page tabs (see SupportHub). This is where the "Dev" sidebar
// item + the Developer Platform's "Support" nav land. Strictly gated to the
// `dev` role (ProtectedRoute + DEV_PLATFORM_ROLES); the standalone /dev/* pages
// remain for deep-links. The staff-facing "Report a problem" popup is untouched.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import SupportHub from "@/components/dev-platform/SupportHub";

// ProtectedRoute compares role strings upper-cased.
const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function SupportHubPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Support — Developer Platform</title>
      </Head>
      <SupportHub />
    </ProtectedRoute>
  );
}

SupportHubPage.getLayout = withDevPlatformLayout({ activeKey: "support" });
