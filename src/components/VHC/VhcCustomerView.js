// file location: src/components/VHC/VhcCustomerView.js
// Shared customer-facing VHC view used by /vhc/customer-preview/[jobNumber],
// /vhc/customer-view/[jobNumber], /vhc/share/[jobNumber]/[linkCode], and
// /vhc/customer/[jobNumber]/[linkCode]. Mobile-first, full-width, customer-friendly.
"use client";

import React, { useMemo, useState } from "react";
import Head from "next/head";
import BrandLogo from "@/components/BrandLogo";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "£0.00";
  return `£${num.toFixed(2)}`;
};

const SEVERITY_THEME = {
  red: { bg: "var(--danger-surface)", text: "var(--danger)", label: "Red Items", toneClass: "app-tone-danger" },
  amber: { bg: "var(--warning-surface)", text: "var(--warning)", label: "Amber Items", toneClass: "app-tone-warning" },
  green: { bg: "var(--success-surface)", text: "var(--success)", label: "Green Items", toneClass: "app-tone-success" },
  authorized: { bg: "var(--success-surface)", text: "var(--success)", label: "Authorised", toneClass: "app-tone-success" },
  declined: { bg: "var(--danger-surface)", text: "var(--danger)", label: "Declined", toneClass: "app-tone-danger" }
};

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

  const originalSeverity = item.severityKey || item.rawSeverity;
  const rowBg =
    severity === "authorized"
      ? "var(--success-surface)"
      : severity === "declined"
      ? "var(--danger-surface)"
      : (isAuthorized || isDeclined)
      ? originalSeverity === "red"
        ? "var(--danger-surface)"
        : originalSeverity === "amber"
        ? "var(--warning-surface)"
        : "transparent"
      : "transparent";

  return (
    <div
      style={{
        padding: "14px 14px",
        background: rowBg,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--txt-bright)", marginTop: 2 }}>
          {reportedDescription}
        </div>
        {measurement && (
          <div style={{ fontSize: 12, color: "var(--txt-mute)", marginTop: 4 }}>{measurement}</div>
        )}
        {supplementaryRows.length > 0 && (
          <div style={{ display: "grid", gap: 3, marginTop: 6 }}>
            {supplementaryRows.map((row) => (
              <div key={row} style={{ fontSize: 12, color: "var(--txt-soft)", lineHeight: 1.35 }}>
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
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            fontSize: 12
          }}
        >
          <div>
            <div style={{ color: "var(--txt-mute)", fontSize: 11 }}>Parts</div>
            <div style={{ fontWeight: 600, color: "var(--txt-bright)" }}>
              {formatCurrency(partsCost)}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--txt-mute)", fontSize: 11 }}>Labour</div>
            <div style={{ fontWeight: 600, color: "var(--txt-bright)" }}>
              {labourHours > 0 ? `${labourHours}h · ${formatCurrency(labourCost)}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--txt-mute)", fontSize: 11 }}>Total</div>
            <div style={{ fontWeight: 700, color: "var(--txt-bright)" }}>
              {formatCurrency(total)}
            </div>
          </div>
        </div>
      )}

      {interactive && !isGreen && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              if (isAuthorized) onUpdateStatus?.(item.id, null);
              else onRequestAuthorise?.(item);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--success-surface)",
              color: "var(--success)",
              fontWeight: 600,
              fontSize: 13,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1,
              boxShadow: isAuthorized ? "inset 0 0 0 2px var(--success)" : "inset 0 0 0 1px var(--success)",
              touchAction: "manipulation"
            }}
          >
            {isAuthorized ? "✓ Authorised" : "Authorise"}
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onUpdateStatus?.(item.id, isDeclined ? null : "declined")}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--danger-surface)",
              color: "var(--danger)",
              fontWeight: 600,
              fontSize: 13,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1,
              boxShadow: isDeclined ? "inset 0 0 0 2px var(--danger)" : "inset 0 0 0 1px var(--danger)",
              touchAction: "manipulation"
            }}
          >
            {isDeclined ? "✗ Declined" : "Decline"}
          </button>
        </div>
      )}

      {hasDivider && (
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: "var(--surface)",
            marginTop: 2
          }}
        />
      )}
    </div>
  );
}

function Section({ title, items, severity, interactive, onUpdateStatus, onRequestAuthorise, updatingIds }) {
  const theme = SEVERITY_THEME[severity] || { bg: "var(--website-elev-1)", text: "var(--txt-bright)" };
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

  return (
    <div
      className={theme.toneClass || ""}
      style={{
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        marginBottom: 14
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center"
        }}
      >
        <span>{title}</span>
        {(authorizedTotal > 0 || declinedTotal > 0) && (
          <div style={{ display: "flex", gap: 12, fontSize: 11, textTransform: "none", fontWeight: 600 }}>
            {authorizedTotal > 0 && (
              <span style={{ color: "var(--success)" }}>
                Authorised: {formatCurrency(authorizedTotal)}
              </span>
            )}
            {declinedTotal > 0 && (
              <span style={{ color: "var(--danger)" }}>
                Declined: {formatCurrency(declinedTotal)}
              </span>
            )}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: "var(--txt-mute)" }}>No items recorded.</div>
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
    </div>
  );
}

function TotalsGrid({ totals }) {
  const items = [
    { label: "Red Work", value: totals.red, color: "var(--danger)", statusClass: "app-status-message--danger" },
    { label: "Amber Work", value: totals.amber, color: "var(--warning)", statusClass: "app-status-message--warning" },
    { label: "Authorised", value: totals.authorized, color: "var(--success)", statusClass: "app-status-message--success" },
    { label: "Declined", value: totals.declined, color: "var(--danger)", statusClass: "app-status-message--danger" }
  ];
  return (
    <LayerSurface
      radius="var(--radius-md)"
      padding="0"
      gap="0"
      style={{ marginBottom: 14, overflow: "hidden" }}
    >
      <div
        style={{
          padding: "12px 14px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--txt-mute)"
        }}
      >
        Work Summary
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8,
          padding: 0
        }}
      >
        {items.map((it) => (
          <div
            key={it.label}
            className={`app-status-message ${it.statusClass}`}
            style={{
              minHeight: 72,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
              borderRadius: "var(--radius-sm)"
            }}
          >
            <div style={{ fontSize: 11, color: "var(--txt-mute)" }}>{it.label}</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: it.color,
                lineHeight: 1.2
              }}
            >
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
    <LayerSurface radius="var(--radius-md)" padding="12px 14px" gap="4px" style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--txt-mute)"
        }}
      >
        Read-only share
      </div>
      <div style={{ fontSize: 13, color: "var(--txt-soft)" }}>
        This shared link can view the report, photos and videos. Authorising or declining work is only available from the customer view.
      </div>
    </LayerSurface>
  );
}

function PhotosTab({ photoFiles }) {
  if (photoFiles.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: "var(--radius-sm)",
          background: "var(--website-elev-1)",
          color: "var(--txt-mute)",
          fontSize: 13
        }}
      >
        No photos have been uploaded for this job.
      </div>
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
        <div
          key={file.file_id}
          style={{
            background: "var(--website-elev-1)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden"
          }}
        >
          <div style={{ position: "relative", paddingTop: "75%", background: "var(--website-elev-2)" }}>
            <img
              src={file.file_url}
              alt={file.file_name || "Photo"}
              loading="lazy"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          </div>
          <div style={{ padding: "8px 10px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--txt-bright)",
                wordBreak: "break-word"
              }}
            >
              {file.file_name || "Unnamed photo"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideosTab({ videoFiles }) {
  if (videoFiles.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: "var(--radius-sm)",
          background: "var(--website-elev-1)",
          color: "var(--txt-mute)",
          fontSize: 13
        }}
      >
        No videos have been uploaded for this job.
      </div>
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
        <div
          key={file.file_id}
          style={{
            background: "var(--website-elev-1)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden"
          }}
        >
          <div style={{ position: "relative", paddingTop: "56.25%", background: "var(--website-elev-2)" }}>
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
          </div>
          <div style={{ padding: "8px 10px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--txt-bright)",
                wordBreak: "break-word"
              }}
            >
              {file.file_name || "Unnamed video"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthoriseConfirmModal({ item, authorizedTotal = 0, onConfirm, onDecline, onClose, isUpdating }) {
  if (!item) return null;

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
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "color-mix(in srgb, var(--surface) 78%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <LayerSurface
        role="dialog"
        aria-modal="true"
        aria-labelledby="vhc-authorise-confirm-title"
        radius="var(--radius-md)"
        padding="18px"
        gap="14px"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 460px)",
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <div>
          <div
            id="vhc-authorise-confirm-title"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--txt-bright)",
              lineHeight: 1.25
            }}
          >
            Confirm authorisation
          </div>
          <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 6 }}>
            Please confirm this work before it is sent to the workshop.
          </div>
        </div>

        <LayerTheme radius="var(--radius-sm)" padding="14px" gap="8px">
          <div style={{ fontSize: 15, color: "var(--txt-bright)", fontWeight: 700 }}>
            {reportedDescription}
          </div>
        </LayerTheme>

        <LayerTheme radius="var(--radius-sm)" padding="14px" gap="10px">
          <div style={{ fontSize: 12, color: "var(--txt-mute)", fontWeight: 700 }}>
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
              <div style={{ fontSize: 11, color: "var(--txt-mute)" }}>Current authorised</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--txt-bright)" }}>
                {formatCurrency(safeCurrentAuthorizedTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--txt-mute)" }}>This item</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>
                {formatCurrency(safeItemTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--txt-mute)" }}>New total</div>
              <div style={{ fontSize: 22, lineHeight: 1.1, fontWeight: 800, color: "var(--success)" }}>
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
          <button
            type="button"
            disabled={isUpdating}
            onClick={onConfirm}
            style={{
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--success-surface)",
              color: "var(--success)",
              boxShadow: "inset 0 0 0 1px var(--success)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1,
              touchAction: "manipulation"
            }}
          >
            Confirm authorise
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={onDecline}
            style={{
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--danger-surface)",
              color: "var(--danger)",
              boxShadow: "inset 0 0 0 1px var(--danger)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1,
              touchAction: "manipulation"
            }}
          >
            Decline item
          </button>
        </div>

        <button
          type="button"
          disabled={isUpdating}
          onClick={onClose}
          style={{
            minHeight: 44,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--website-elev-2)",
            color: "var(--txt-bright)",
            fontSize: 13,
            fontWeight: 700,
            cursor: isUpdating ? "not-allowed" : "pointer",
            opacity: isUpdating ? 0.6 : 1,
            touchAction: "manipulation"
          }}
        >
          Back to report
        </button>
      </LayerSurface>
    </div>
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

  return (
    <>
      <Head>
        <title>Vehicle Health Check - Job #{jobNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          minHeight: "100dvh",
          background: "var(--surface)",
          color: "var(--txt-bright)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {previewBanner}

        {/* Compact sticky header — full-width */}
        <header
          style={{
            background: "var(--surface)",
            boxShadow: "inset 0 -1px 0 var(--separating-line)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: 0
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              margin: "0 auto",
              boxSizing: "border-box",
              padding: "10px 12px 0"
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap"
              }}
            >
            <BrandLogo alt="HP Logo" width={84} height={36} style={{ objectFit: "contain", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--txt-bright)",
                  lineHeight: 1.2
                }}
              >
                Vehicle Health Check
              </div>
              <div style={{ fontSize: 12, color: "var(--txt-soft)", marginTop: 2 }}>
                Job #{jobNumber}
                {vehicleInfo?.registration ? ` · ${vehicleInfo.registration}` : ""}
                {vehicleInfo?.make || vehicleInfo?.model
                  ? ` · ${[vehicleInfo?.make, vehicleInfo?.model].filter(Boolean).join(" ")}`
                  : ""}
              </div>
              {customerInfo?.name && (
                <div style={{ fontSize: 12, color: "var(--txt-mute)", marginTop: 1 }}>
                  {customerInfo.name}
                </div>
              )}
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  flexShrink: 0,
                  minHeight: 36,
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--website-elev-2)",
                  color: "var(--txt-bright)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                ← Back
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 10,
              overflowX: "auto"
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 14px",
                  background: "transparent",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: 13,
                  color: activeTab === tab.id ? "var(--accentText)" : "var(--txt-mute)",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          </div>
        </header>

        {/* Main content — full width with light side padding only */}
        <main
          style={{
            flex: 1,
            padding: "14px 12px 28px",
            width: "100%",
            maxWidth: 900,
            margin: "0 auto",
            boxSizing: "border-box"
          }}
        >
          {activeTab === "summary" && (
            <>
              <AccessNotice accessMode={accessMode} />
              <TotalsGrid totals={totals} />

              {severityLists.red?.length > 0 && (
                <Section
                  title="Red Items"
                  items={severityLists.red}
                  severity="red"
                  interactive={interactive}
                  onUpdateStatus={onUpdateStatus}
                  onRequestAuthorise={setPendingAuthoriseItem}
                  updatingIds={updatingIds}
                />
              )}
              {severityLists.amber?.length > 0 && (
                <Section
                  title="Amber Items"
                  items={severityLists.amber}
                  severity="amber"
                  interactive={interactive}
                  onUpdateStatus={onUpdateStatus}
                  onRequestAuthorise={setPendingAuthoriseItem}
                  updatingIds={updatingIds}
                />
              )}
              {severityLists.authorized?.length > 0 && (
                <Section
                  title="Authorised"
                  items={severityLists.authorized}
                  severity="authorized"
                  interactive={interactive}
                  onUpdateStatus={onUpdateStatus}
                  onRequestAuthorise={setPendingAuthoriseItem}
                  updatingIds={updatingIds}
                />
              )}
              {severityLists.declined?.length > 0 && (
                <Section
                  title="Declined"
                  items={severityLists.declined}
                  severity="declined"
                  interactive={interactive}
                  onUpdateStatus={onUpdateStatus}
                  onRequestAuthorise={setPendingAuthoriseItem}
                  updatingIds={updatingIds}
                />
              )}
              {severityLists.green?.length > 0 && (
                <Section
                  title="Green Items"
                  items={severityLists.green}
                  severity="green"
                  interactive={interactive}
                  onUpdateStatus={onUpdateStatus}
                  onRequestAuthorise={setPendingAuthoriseItem}
                  updatingIds={updatingIds}
                />
              )}
            </>
          )}

          {activeTab === "photos" && <PhotosTab photoFiles={photoFiles} />}
          {activeTab === "videos" && <VideosTab videoFiles={videoFiles} />}
        </main>

        <footer
          style={{
            background: "var(--surface)",
            boxShadow: "inset 0 1px 0 var(--separating-line)",
            padding: "12px 14px",
            textAlign: "center"
          }}
        >
          <div style={{ fontSize: 11, color: "var(--txt-mute)" }}>
            Vehicle Health Check Report · Job #{jobNumber}
            {expiresAt && (
              <>
                {" · "}
                <span style={{ color: "var(--danger)" }}>
                  Link expires {new Date(expiresAt).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </footer>
      </div>

      <AuthoriseConfirmModal
        item={pendingAuthoriseItem}
        authorizedTotal={totals?.authorized}
        onConfirm={confirmAuthorise}
        onDecline={declineFromConfirm}
        onClose={closeAuthoriseConfirm}
        isUpdating={isConfirmUpdating}
      />
    </>
  );
}
