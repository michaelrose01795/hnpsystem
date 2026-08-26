// file location: src/components/VHC/VhcCustomerView.js
// Shared customer-facing VHC view used by /vhc/customer-preview/[jobNumber],
// /vhc/customer-view/[jobNumber], /vhc/share/[jobNumber]/[linkCode], and
// /vhc/customer/[jobNumber]/[linkCode]. Mobile-first, full-width, customer-friendly.
//
// Design system (2026-08 pass): these routes are staff-scope routes — _app.js
// puts `staff-scope` on <html> for anything outside /website — so the whole
// staffglobal.css family system applies here and is what this file now uses:
//   tabs    → .app-layout-tab-row + .app-tab/.app-tab--pill
//   buttons → <Button> / .app-btn variants
//   cards   → <LayerSurface> / <LayerTheme> with strict alternation
//   popup   → <ModalPortal> + .popup-backdrop / .popup-card
//   empty   → .app-empty-state
// Severity colour comes from the approved tone utilities (.app-tone-*), not
// from local fills.
"use client";

import React, { useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";

// next/image only accepts hosts listed in next.config.mjs `images.remotePatterns`
// (the Supabase Storage object path). Anything else — a legacy absolute URL, an
// external link — must render through a plain <img>, because next/image throws on
// an unconfigured host rather than degrading. Relative paths are always fine.
const OPTIMISABLE_IMAGE_PATH = "/storage/v1/object/";
const optimisedPhotoSrc = (url) => {
  const value = String(url || "");
  if (!value) return null;
  if (value.startsWith("/")) return value; // same-origin
  return value.includes(OPTIMISABLE_IMAGE_PATH) ? value : null;
};
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import ModalPortal from "@/components/popups/ModalPortal";

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "£0.00";
  return `£${num.toFixed(2)}`;
};

// toneClass tints the rows; headerClass is the solid version of the same colour
// so the section heading reads as a banner above its own rows rather than
// dissolving into them.
const SEVERITY_THEME = {
  red: { label: "Red Items", toneClass: "app-tone-danger", headerClass: "app-tone-danger-strong" },
  amber: { label: "Amber Items", toneClass: "app-tone-warning", headerClass: "app-tone-warning-strong" },
  green: { label: "Green Items", toneClass: "app-tone-success", headerClass: "app-tone-success-strong" },
  authorized: { label: "Authorised", toneClass: "app-tone-success", headerClass: "app-tone-success-strong" },
  declined: { label: "Declined", toneClass: "app-tone-danger", headerClass: "app-tone-danger-strong" }
};

// Row rule between list items — the one allowed "line within a list" (CLAUDE.md
// §3.0a). Uses --separating-line-color, not a hand-mixed accent alpha.
function CustomerDivider() {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      style={{
        width: "100%",
        height: 1,
        flexShrink: 0,
        background: "var(--separating-line-color)"
      }}
    />
  );
}

const normaliseDetailText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const resolveTyreDetailRows = (item = {}, measurement = "") => {
  const sourceRows = Array.isArray(item.tyreDetailRows) ? item.tyreDetailRows : [];
  const seen = new Set();
  return sourceRows
    .map((row) => String(row || "").trim())
    .filter(Boolean)
    .filter((row) => {
      const key = normaliseDetailText(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return key !== normaliseDetailText(measurement);
    });
};

const resolveSpareDetailRows = (item = {}) => {
  const label = normaliseDetailText(item.label || item.sectionName);
  if (!label.includes("spare") && !label.includes("repair kit")) return [];
  return (Array.isArray(item.rows) ? item.rows : [])
    .map((row) => String(row || "").trim())
    .filter(Boolean);
};

function Row({ item, severity, interactive, onUpdateStatus, onRequestAuthorise, isUpdating, hasDivider = true }) {
  const isAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
  const isDeclined = item.approvalStatus === "declined";
  const total = Number(item.total_gbp ?? item.total ?? 0);
  const partsCost = Number(item.parts_gbp ?? item.partsCost ?? 0);
  const labourHours = Number(item.labour_hours ?? item.labourHours ?? 0);
  const labourRate = Number(item.labour_rate_gbp ?? 85);
  const labourCost = Number.isFinite(labourHours) ? labourHours * labourRate : 0;

  const detailLabel = item.label || item.sectionName || "Recorded item";
  const detailContent = item.concernText || item.notes || "";
  const reportedDescription = detailContent || detailLabel;
  const measurement = item.measurement || "";
  const tyreDetailRows = resolveTyreDetailRows(item, measurement);
  const spareDetailRows = resolveSpareDetailRows(item);
  const supplementaryRows = tyreDetailRows.length > 0 ? tyreDetailRows : spareDetailRows;

  // Green items are passing checks — only show description, no pricing or actions
  const isGreen = severity === "green";

  // Every row carries its section's severity tint — a Red row is red, an Amber
  // row amber, a Green row green — so the customer can tell at a glance what
  // they are looking at without reading the heading. The fill comes from the
  // approved tone utilities (.app-tone-*), never a local colour.
  const rowToneClass = SEVERITY_THEME[severity]?.toneClass || "";

  return (
    <div
      className={rowToneClass}
      style={{
        padding: "clamp(12px, 3.5vw, 16px)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div>
        <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: "var(--text-1)" }}>
          {reportedDescription}
        </div>
        {measurement && (
          <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)", marginTop: 4 }}>
            {measurement}
          </div>
        )}
        {supplementaryRows.length > 0 && (
          <div style={{ display: "grid", gap: 3, marginTop: 6 }}>
            {supplementaryRows.map((row) => (
              <div key={row} style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", lineHeight: 1.35 }}>
                {row}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isGreen && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
            gap: 8
          }}
        >
          <div>
            <div style={{ color: "var(--surfaceTextMuted)", fontSize: "var(--text-caption)" }}>Parts</div>
            <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
              {formatCurrency(partsCost)}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--surfaceTextMuted)", fontSize: "var(--text-caption)" }}>Labour</div>
            <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
              {labourHours > 0 ? `${labourHours}h · ${formatCurrency(labourCost)}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--surfaceTextMuted)", fontSize: "var(--text-caption)" }}>Total</div>
            <div style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
              {formatCurrency(total)}
            </div>
          </div>
        </div>
      )}

      {interactive && !isGreen && (
        // Wraps to a stack below ~260px of row width so the two 44px targets
        // never squash on a narrow phone in portrait.
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button
            variant={isAuthorized ? "primary" : "secondary"}
            size="sm"
            disabled={isUpdating}
            aria-pressed={isAuthorized}
            style={{ flex: "1 1 120px", touchAction: "manipulation" }}
            onClick={() => {
              if (isAuthorized) onUpdateStatus?.(item.id, null);
              else onRequestAuthorise?.(item);
            }}
          >
            {isAuthorized ? "✓ Authorised" : "Authorise"}
          </Button>
          <Button
            variant={isDeclined ? "danger" : "ghost"}
            size="sm"
            disabled={isUpdating}
            aria-pressed={isDeclined}
            style={{ flex: "1 1 120px", touchAction: "manipulation" }}
            onClick={() => onUpdateStatus?.(item.id, isDeclined ? null : "declined")}
          >
            {isDeclined ? "✗ Declined" : "Decline"}
          </Button>
        </div>
      )}

      {hasDivider && <CustomerDivider />}
    </div>
  );
}

function Section({ title, items, severity, interactive, onUpdateStatus, onRequestAuthorise, updatingIds }) {
  const theme = SEVERITY_THEME[severity] || { toneClass: "", headerClass: "" };
  let authorizedTotal = 0;
  let declinedTotal = 0;
  items.forEach((item) => {
    const total = Number(item.total_gbp ?? item.total ?? 0);
    if (item.approvalStatus === "authorized" || item.approvalStatus === "completed") {
      authorizedTotal += total;
    } else if (item.approvalStatus === "declined") {
      declinedTotal += total;
    }
  });

  // Page background is --surface, so a section card is the next rung down:
  // LayerSurface here, LayerTheme for anything nested inside it.
  return (
    <LayerSurface
      radius="var(--radius-md)"
      padding="0"
      gap="0"
      style={{ overflow: "hidden" }}
    >
      <div
        className={theme.headerClass}
        style={{
          padding: "clamp(10px, 3vw, 14px)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: "var(--text-caption)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "4px 12px",
          alignItems: "center"
        }}
      >
        <span>{title}</span>
        {(authorizedTotal > 0 || declinedTotal > 0) && (
          // Inherits the header's on-tone text colour: a second colour here
          // would be unreadable on the solid severity fill.
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2px 12px",
              fontSize: "var(--text-caption)",
              textTransform: "none",
              fontWeight: 600
            }}
          >
            {authorizedTotal > 0 && <span>Authorised: {formatCurrency(authorizedTotal)}</span>}
            {declinedTotal > 0 && <span>Declined: {formatCurrency(declinedTotal)}</span>}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div className="app-empty-state app-empty-state--bare">
          <p className="app-empty-state__description">No items recorded.</p>
        </div>
      ) : (
        items.map((item, index) => (
          <Row
            key={`${severity}-${item.id}`}
            item={item}
            severity={severity}
            interactive={interactive}
            onUpdateStatus={onUpdateStatus}
            onRequestAuthorise={onRequestAuthorise}
            isUpdating={updatingIds?.has(item.id)}
            hasDivider={index < items.length - 1}
          />
        ))
      )}
    </LayerSurface>
  );
}

function TotalsGrid({ totals }) {
  const items = [
    { label: "Red Work", value: totals.red, color: "var(--danger-text)", statusClass: "app-status-message--danger" },
    { label: "Amber Work", value: totals.amber, color: "var(--warning-text)", statusClass: "app-status-message--warning" },
    { label: "Authorised", value: totals.authorized, color: "var(--success-text)", statusClass: "app-status-message--success" },
    { label: "Declined", value: totals.declined, color: "var(--danger-text)", statusClass: "app-status-message--danger" }
  ];
  return (
    <LayerSurface radius="var(--radius-md)" padding="0" gap="0" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 14px",
          fontSize: "var(--text-caption)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--surfaceTextMuted)"
        }}
      >
        Work Summary
      </div>
      <CustomerDivider />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8
        }}
      >
        {items.map((it) => (
          <div
            key={it.label}
            className={`app-status-message ${it.statusClass}`}
            style={{
              minHeight: 72,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4
            }}
          >
            <div style={{ fontSize: "var(--text-caption)", fontWeight: 600 }}>{it.label}</div>
            <div style={{ fontSize: "var(--text-h4)", fontWeight: 700, color: it.color, lineHeight: 1.2 }}>
              {formatCurrency(it.value)}
            </div>
          </div>
        ))}
      </div>
    </LayerSurface>
  );
}

function AccessNotice({ accessMode }) {
  if (accessMode !== "share") return null;
  return (
    <div className="app-status-message app-status-message--info">
      <div
        style={{
          fontSize: "var(--text-caption)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--surfaceTextMuted)"
        }}
      >
        Read-only share
      </div>
      <div style={{ fontSize: "var(--text-body-sm)", fontWeight: 500, marginTop: 4 }}>
        This shared link can view the report, photos and videos. Authorising or declining work is only available from the customer view.
      </div>
    </div>
  );
}

function MediaEmptyState({ title, description }) {
  return (
    <div className="app-empty-state app-empty-state--inline">
      <div className="app-empty-state__copy">
        <p className="app-empty-state__title">{title}</p>
        <p className="app-empty-state__description">{description}</p>
      </div>
    </div>
  );
}

function PhotosTab({ photoFiles }) {
  if (photoFiles.length === 0) {
    return (
      <MediaEmptyState
        title="No photos yet"
        description="No photos have been uploaded for this job."
      />
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10
      }}
    >
      {photoFiles.map((file) => (
        // Media tiles sit on the page's --surface background, so the tile is a
        // LayerSurface and the letterbox behind the image is its --theme nest.
        <LayerSurface
          key={file.file_id}
          radius="var(--radius-sm)"
          padding="0"
          gap="0"
          style={{ overflow: "hidden" }}
        >
          {/* These are technician phone photos straight from Supabase Storage —
              routinely 2-5MB each — rendered into a ~160px grid cell on a
              customer's mobile. next/image serves a resized WebP/AVIF variant at
              the size actually displayed instead of the original file.
              `optimisedPhotoSrc` returns null for any URL outside the host
              configured in next.config.mjs `images.remotePatterns`, in which case
              we fall back to the plain <img> rather than throwing. */}
          <LayerTheme radius="0" padding="0" gap="0" style={{ position: "relative", paddingTop: "75%" }}>
            {optimisedPhotoSrc(file.file_url) ? (
              <Image
                src={file.file_url}
                alt={file.file_name || "Photo"}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 45vw, 180px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <img
                src={file.file_url}
                alt={file.file_name || "Photo"}
                loading="lazy"
                decoding="async"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            )}
          </LayerTheme>
          <div style={{ padding: "8px 10px" }}>
            <div
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: 500,
                color: "var(--text-1)",
                wordBreak: "break-word"
              }}
            >
              {file.file_name || "Unnamed photo"}
            </div>
          </div>
        </LayerSurface>
      ))}
    </div>
  );
}

function VideosTab({ videoFiles }) {
  if (videoFiles.length === 0) {
    return (
      <MediaEmptyState
        title="No videos yet"
        description="No videos have been uploaded for this job."
      />
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12
      }}
    >
      {videoFiles.map((file) => (
        <LayerSurface
          key={file.file_id}
          radius="var(--radius-sm)"
          padding="0"
          gap="0"
          style={{ overflow: "hidden" }}
        >
          <LayerTheme radius="0" padding="0" gap="0" style={{ position: "relative", paddingTop: "56.25%" }}>
            <video
              src={file.file_url}
              controls
              playsInline
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain"
              }}
            />
          </LayerTheme>
          <div style={{ padding: "8px 10px" }}>
            <div
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: 500,
                color: "var(--text-1)",
                wordBreak: "break-word"
              }}
            >
              {file.file_name || "Unnamed video"}
            </div>
          </div>
        </LayerSurface>
      ))}
    </div>
  );
}

// Canonical popup shell: ModalPortal (body scroll lock + portal node) wrapping
// the shared .popup-backdrop / .popup-card chrome from staffglobal.css, so this
// dialog gets the same backdrop, viewport gap and portrait handling as every
// other popup in the app.
function AuthoriseConfirmModal({ item, authorizedTotal = 0, onConfirm, onDecline, onClose, isUpdating }) {
  const itemTotal = Number(item.total_gbp ?? item.total ?? 0);
  const currentAuthorizedTotal = Number(authorizedTotal);
  const safeItemTotal = Number.isFinite(itemTotal) ? itemTotal : 0;
  const safeCurrentAuthorizedTotal = Number.isFinite(currentAuthorizedTotal) ? currentAuthorizedTotal : 0;
  const itemAlreadyAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
  const newAuthorizedTotal = itemAlreadyAuthorized
    ? safeCurrentAuthorizedTotal
    : safeCurrentAuthorizedTotal + safeItemTotal;
  const detailLabel = item.label || item.sectionName || "Recorded item";
  const detailContent = item.concernText || item.notes || "";
  const reportedDescription = detailContent || detailLabel;

  return (
    <ModalPortal>
      <div className="popup-backdrop" role="presentation" onClick={onClose}>
        <LayerSurface
          className="popup-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vhc-authorise-confirm-title"
          radius="var(--radius-lg)"
          padding="18px"
          gap="14px"
          onClick={(event) => event.stopPropagation()}
          style={{ width: "min(100%, 460px)" }}
        >
          <div>
            <div
              id="vhc-authorise-confirm-title"
              style={{
                fontSize: "var(--text-h3)",
                fontWeight: 800,
                color: "var(--text-1)",
                lineHeight: 1.25
              }}
            >
              Confirm authorisation
            </div>
            <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", marginTop: 6 }}>
              Please confirm this work before it is sent to the workshop.
            </div>
          </div>

          <LayerTheme radius="var(--radius-sm)" padding="14px" gap="8px">
            <div style={{ fontSize: "var(--text-body)", color: "var(--text-1)", fontWeight: 700 }}>
              {reportedDescription}
            </div>
          </LayerTheme>

          <LayerTheme radius="var(--radius-sm)" padding="14px" gap="10px">
            <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)", fontWeight: 700 }}>
              Total to authorise
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8
              }}
            >
              <div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)" }}>Current authorised</div>
                <div style={{ fontSize: "var(--text-h4)", fontWeight: 800, color: "var(--text-1)" }}>
                  {formatCurrency(safeCurrentAuthorizedTotal)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)" }}>This item</div>
                <div style={{ fontSize: "var(--text-h4)", fontWeight: 800, color: "var(--success-text)" }}>
                  {formatCurrency(safeItemTotal)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)" }}>New total</div>
                <div style={{ fontSize: "var(--text-h2)", lineHeight: 1.1, fontWeight: 800, color: "var(--success-text)" }}>
                  {formatCurrency(newAuthorizedTotal)}
                </div>
              </div>
            </div>
          </LayerTheme>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8
            }}
          >
            <Button
              variant="primary"
              disabled={isUpdating}
              onClick={onConfirm}
              style={{ touchAction: "manipulation" }}
            >
              Confirm authorise
            </Button>
            <Button
              variant="danger"
              disabled={isUpdating}
              onClick={onDecline}
              style={{ touchAction: "manipulation" }}
            >
              Decline item
            </Button>
          </div>

          <Button
            variant="ghost"
            disabled={isUpdating}
            onClick={onClose}
            style={{ touchAction: "manipulation" }}
          >
            Back to report
          </Button>
        </LayerSurface>
      </div>
    </ModalPortal>
  );
}

export default function VhcCustomerView({
  jobNumber,
  vehicleInfo,
  customerInfo,
  severityLists,
  totals,
  photoFiles,
  videoFiles,
  activeTab,
  setActiveTab,
  interactive = false,
  onUpdateStatus,
  updatingIds,
  previewBanner = null,
  expiresAt = null,
  onBack = null,
  accessMode = "customer"
}) {
  const [pendingAuthoriseItem, setPendingAuthoriseItem] = useState(null);
  const tabs = useMemo(() => {
    const list = [{ id: "summary", label: "Summary" }];
    if (photoFiles.length > 0) list.push({ id: "photos", label: `Photos (${photoFiles.length})` });
    if (videoFiles.length > 0) list.push({ id: "videos", label: `Videos (${videoFiles.length})` });
    return list;
  }, [photoFiles.length, videoFiles.length]);
  const pendingAuthoriseId = pendingAuthoriseItem?.id;
  const isConfirmUpdating = pendingAuthoriseId ? updatingIds?.has(pendingAuthoriseId) : false;

  const closeAuthoriseConfirm = () => {
    if (!isConfirmUpdating) setPendingAuthoriseItem(null);
  };

  const confirmAuthorise = () => {
    if (!pendingAuthoriseItem?.id) return;
    onUpdateStatus?.(pendingAuthoriseItem.id, "authorized");
    setPendingAuthoriseItem(null);
  };

  const declineFromConfirm = () => {
    if (!pendingAuthoriseItem?.id) return;
    onUpdateStatus?.(pendingAuthoriseItem.id, "declined");
    setPendingAuthoriseItem(null);
  };

  const severitySections = [
    { key: "red", title: "Red Items" },
    { key: "amber", title: "Amber Items" },
    { key: "authorized", title: "Authorised" },
    { key: "declined", title: "Declined" },
    { key: "green", title: "Green Items" }
  ];

  return (
    <>
      <Head>
        <title>Vehicle Health Check - Job #{jobNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div
        className="app-page-shell"
        style={{
          minHeight: "100dvh",
          background: "var(--surface)",
          color: "var(--text-1)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {previewBanner}

        {/* Compact sticky header — full-width */}
        <header
          style={{
            background: "var(--surface)",
            position: "sticky",
            top: 0,
            zIndex: 50
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              margin: "0 auto",
              boxSizing: "border-box",
              padding: "12px 12px 0"
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <BrandLogo alt="HP Logo" width={84} height={36} style={{ objectFit: "contain", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.2 }}>
                  Vehicle Health Check
                </div>
                <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", marginTop: 2 }}>
                  Job #{jobNumber}
                  {vehicleInfo?.registration ? ` · ${vehicleInfo.registration}` : ""}
                  {vehicleInfo?.make || vehicleInfo?.model
                    ? ` · ${[vehicleInfo?.make, vehicleInfo?.model].filter(Boolean).join(" ")}`
                    : ""}
                </div>
                {customerInfo?.name && (
                  <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)", marginTop: 1 }}>
                    {customerInfo.name}
                  </div>
                )}
              </div>
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} style={{ flexShrink: 0 }}>
                  ← Back
                </Button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <CustomerDivider />
            </div>

            {/* Tab switcher — canonical tab family (.app-layout-tab-row + .app-tab) */}
            <div
              className="app-layout-tab-row"
              role="tablist"
              aria-label="Vehicle health check sections"
              style={{
                display: "flex",
                gap: 6,
                padding: "6px 0",
                overflowX: "auto",
                scrollbarWidth: "none"
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="app-tab app-tab--pill"
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`vhc-tabpanel-${tab.id}`}
                  id={`vhc-tab-${tab.id}`}
                  style={{ minHeight: 44 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <CustomerDivider />
          </div>
        </header>

        {/* Main content — full width with light side padding only */}
        <main
          className="app-page-stack"
          style={{
            flex: 1,
            padding: "18px 12px 28px",
            width: "100%",
            maxWidth: 900,
            margin: "0 auto",
            boxSizing: "border-box"
          }}
        >
          {activeTab === "summary" && (
            <div
              id="vhc-tabpanel-summary"
              role="tabpanel"
              aria-labelledby="vhc-tab-summary"
              className="app-page-stack"
            >
              <AccessNotice accessMode={accessMode} />
              <TotalsGrid totals={totals} />

              {severitySections.map(({ key, title }) =>
                severityLists[key]?.length > 0 ? (
                  <Section
                    key={key}
                    title={title}
                    items={severityLists[key]}
                    severity={key}
                    interactive={interactive}
                    onUpdateStatus={onUpdateStatus}
                    onRequestAuthorise={setPendingAuthoriseItem}
                    updatingIds={updatingIds}
                  />
                ) : null
              )}
            </div>
          )}

          {activeTab === "photos" && (
            <div id="vhc-tabpanel-photos" role="tabpanel" aria-labelledby="vhc-tab-photos">
              <PhotosTab photoFiles={photoFiles} />
            </div>
          )}
          {activeTab === "videos" && (
            <div id="vhc-tabpanel-videos" role="tabpanel" aria-labelledby="vhc-tab-videos">
              <VideosTab videoFiles={videoFiles} />
            </div>
          )}
        </main>

        <footer style={{ background: "var(--surface)", padding: "12px 14px", textAlign: "center" }}>
          <div style={{ margin: "-12px -14px 12px" }}>
            <CustomerDivider />
          </div>
          <div style={{ fontSize: "var(--text-caption)", color: "var(--surfaceTextMuted)" }}>
            Vehicle Health Check Report · Job #{jobNumber}
            {expiresAt && (
              <>
                {" · "}
                <span style={{ color: "var(--danger-text)" }}>
                  Link expires {new Date(expiresAt).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </footer>
      </div>

      {pendingAuthoriseItem && (
        <AuthoriseConfirmModal
          item={pendingAuthoriseItem}
          authorizedTotal={totals?.authorized}
          onConfirm={confirmAuthorise}
          onDecline={declineFromConfirm}
          onClose={closeAuthoriseConfirm}
          isUpdating={isConfirmUpdating}
        />
      )}
    </>
  );
}
