// file location: src/pages/dev/index.js
//
// Phase 8 — Developer Platform home. The entry point for all internal developer
// tooling: a tile grid over the platform's areas (devPlatformNav) rendered inside
// the shared DevPlatformLayout. Strictly gated to the `dev` role.

import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";
import LayerSurface from "@/components/ui/LayerSurface";
import { Panel } from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

// Home links to every area except itself.
const AREAS = DEV_PLATFORM_NAV.filter((item) => item.key !== "home");

function AreaTile({ item }) {
  return (
    <Link href={item.href} style={{ textDecoration: "none", display: "block" }}>
      <LayerSurface
        style={{
          gap: "6px",
          height: "100%",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span aria-hidden style={{ fontSize: "22px", lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontWeight: 700, fontSize: "var(--text-h4, 15px)", color: "var(--accentText)" }}>
            {item.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>
          {item.description}
        </p>
      </LayerSurface>
    </Link>
  );
}

export default function DevPlatformHome() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Developer Platform — HNP System</title>
      </Head>
      <Panel title="Platform areas" subtitle="Live operations, health, support triage, workspaces and preferences.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--layout-card-gap, 12px)",
          }}
        >
          {AREAS.map((item) => (
            <AreaTile key={item.key} item={item} />
          ))}
        </div>
      </Panel>
    </ProtectedRoute>
  );
}

DevPlatformHome.getLayout = withDevPlatformLayout({ activeKey: "home" });
