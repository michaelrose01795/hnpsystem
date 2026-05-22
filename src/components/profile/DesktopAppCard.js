// file location: src/components/profile/DesktopAppCard.js
// Desktop App download UI shown from the /profile Work tab.
//
// Two exports:
//   - default DesktopAppCard   → standalone card (kept for back-compat / other uses)
//   - named   DesktopAppPanel  → panel form used inside the popup modal opened
//                                 from the header "Desktop App" button. Matches
//                                 the SecurityPanel/PrivacyPanel pattern.
//
// Layout follows the staff design system: token-driven colours, the same
// ProfileCard visual contract (var(--surface), var(--radius-md), 16px padding,
// 12px gap), and a borderless surface (CLAUDE.md §3.0a — borders are banned
// outside the five whitelisted use-cases).
//
// The component probes the installer URL with a HEAD request on mount:
//   - 200 OK  → "Download Windows App" button is enabled
//   - 404 / network error → button is disabled and a "Not available yet"
//                            message replaces the small-print
// This means dropping the .exe into /public/downloads/ later is the only
// step needed to switch it on — no code change required.
//
// TODO (publish prerequisite — outside this repo):
//   Windows code-signing certificate. No certificate is configured.
//   Without one, end users will see a SmartScreen "Windows protected
//   your PC" warning on first install. Buy an EV or OV certificate and
//   wire it into electron-builder (win.certificateFile +
//   win.certificatePassword).
//
// Branding: resolved — app/installer icons are built from the square
// 1024×1024 desktop/assets/desktop.png, with a multi-resolution
// desktop/build/icon.ico (16/24/32/48/64/128/256) derived from it.

import React, { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// Fixed public path the Electron installer will be served from.
// To switch the card on, place the built installer at:
//   public/downloads/H-P-System-Setup.exe
const INSTALLER_URL = "/downloads/H-P-System-Setup.exe";

const DEFAULT_VERSION = "1.0.0";
const DEFAULT_LAST_UPDATED = "Not published yet";
const DEFAULT_FILE_SIZE = "~85 MB";

async function probeInstaller(url) {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (response.ok) {
      const contentLength = response.headers.get("content-length");
      const lastModified = response.headers.get("last-modified");
      return {
        available: true,
        size: contentLength ? formatBytes(Number(contentLength)) : null,
        lastModified: lastModified ? formatDate(lastModified) : null,
      };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) return `${mib.toFixed(1)} MB`;
  const kib = bytes / 1024;
  return `${kib.toFixed(0)} KB`;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Card visual contract — mirrors ProfileCard in ProfileWorkTab.js.
const cardStyle = {
  background: "var(--profile-card-bg, var(--surface))",
  borderRadius: "var(--radius-md)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: "none",
};

// Panel form: no outer chrome (popup modal provides it).
const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  minWidth: "min(440px, 100%)",
};

// Inline SVG monitor icon — keeps the component self-contained, no new asset.
function MonitorIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function StatusPill({ tone, label }) {
  const palette = {
    ready: { bg: "rgba(34, 197, 94, 0.12)", fg: "var(--success-base)" },
    pending: { bg: "rgba(245, 158, 11, 0.12)", fg: "var(--warning-base)" },
    checking: { bg: "rgba(var(--accentMainRgb), 0.08)", fg: "var(--text-2, var(--text-1))" },
  }[tone] || { bg: "var(--theme)", fg: "var(--text-1)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: palette.bg,
        color: palette.fg,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "4px 10px",
        borderRadius: "999px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "currentColor",
        }}
      />
      {label}
    </span>
  );
}

function MetaItem({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        background: "var(--theme)",
        borderRadius: "var(--radius-sm, 12px)",
        padding: "10px 12px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          opacity: 0.7,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--text-1)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function DesktopAppBody({ available, fileSize, lastUpdated }) {
  const isChecking = available === null;
  const isAvailable = available === true;

  const statusTone = isChecking ? "checking" : isAvailable ? "ready" : "pending";
  const statusLabel = isChecking
    ? "Checking availability"
    : isAvailable
    ? "Ready to install"
    : "Awaiting publish";

  return (
    <>
      {/* Hero row: icon + title block + status pill */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius-sm, 12px)",
            background: "var(--theme)",
            color: "var(--accentText)",
            flexShrink: 0,
          }}
        >
          <MonitorIcon />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)" }}>
            Desktop App
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-1)", opacity: 0.75 }}>
            Windows installer · runs the DMS as a native desktop app
          </div>
        </div>

        <StatusPill tone={statusTone} label={statusLabel} />
      </div>

      {/* Description */}
      <div style={{ fontSize: "0.86rem", lineHeight: 1.55, color: "var(--text-1)" }}>
        Opens the DMS like normal software — no browser tab, no address bar.
        Sign in with the same login as the web app, with the same permissions.
        Updates still come from the live system.
      </div>

      {/* Primary action */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
        {isAvailable ? (
          <a href={INSTALLER_URL} download style={{ textDecoration: "none" }}>
            <Button type="button" variant="primary" size="sm">
              Download Windows App
            </Button>
          </a>
        ) : (
          <Button type="button" variant="primary" size="sm" disabled>
            {isChecking ? "Checking availability…" : "Download Windows App"}
          </Button>
        )}
      </div>

      {/* Unavailable notice — replaces SmartScreen small-print until file ships */}
      {!isAvailable && !isChecking ? (
        <div
          style={{
            fontSize: "0.78rem",
            lineHeight: 1.5,
            color: "var(--warning-base)",
            background: "rgba(245, 158, 11, 0.1)",
            borderRadius: "var(--radius-sm, 12px)",
            padding: "10px 12px",
          }}
        >
          The Windows installer is not available yet. Speak to an admin —
          once it is published it will appear here automatically.
        </div>
      ) : null}

      {isAvailable ? (
        <div style={{ fontSize: "0.78rem", lineHeight: 1.55, color: "var(--text-1)", opacity: 0.8 }}>
          For Windows PCs only. If Windows shows a warning, choose{" "}
          <strong>More info</strong>, then <strong>Run anyway</strong> — only
          if this installer came from H&amp;P System.
        </div>
      ) : null}

      {/* Metadata grid — Version / Last updated / File size */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "10px",
        }}
      >
        <MetaItem label="Version" value={DEFAULT_VERSION} />
        <MetaItem label="Last updated" value={lastUpdated || DEFAULT_LAST_UPDATED} />
        <MetaItem label="File size" value={fileSize || DEFAULT_FILE_SIZE} />
      </div>

      {/* Support note */}
      <div style={{ fontSize: "0.76rem", lineHeight: 1.5, color: "var(--text-1)", opacity: 0.7 }}>
        Speak to an admin if the install does not open.
      </div>
    </>
  );
}

function useInstallerProbe() {
  const [available, setAvailable] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    probeInstaller(INSTALLER_URL).then((result) => {
      if (cancelled) return;
      setAvailable(result.available);
      if (result.available) {
        setFileSize(result.size);
        setLastUpdated(result.lastModified);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, fileSize, lastUpdated };
}

export default function DesktopAppCard({
  sectionKey = "profile-work-desktop-app",
  parentKey = "",
}) {
  const probe = useInstallerProbe();
  return (
    <DevLayoutSection
      as="div"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={cardStyle}
    >
      <DesktopAppBody {...probe} />
    </DevLayoutSection>
  );
}

export function DesktopAppPanel() {
  const probe = useInstallerProbe();
  return (
    <div style={panelStyle}>
      <DesktopAppBody {...probe} />
    </div>
  );
}
