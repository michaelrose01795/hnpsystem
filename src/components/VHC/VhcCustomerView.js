// file location: src/components/VHC/VhcCustomerView.js
// Shared customer-facing VHC view used by /vhc/customer-preview/[jobNumber] and
// /vhc/customer/[jobNumber]/[linkCode]. Mobile-first, full-width, customer-friendly.
"use client";

import React, { useMemo } from "react";
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
  red: { bg: "var(--danger-surface)", text: "var(--danger)", label: "Red Items" },
  amber: { bg: "var(--warning-surface)", text: "var(--warning)", label: "Amber Items" },
  green: { bg: "var(--success-surface)", text: "var(--success)", label: "Green Items" },
  authorized: { bg: "var(--success-surface)", text: "var(--success)", label: "Authorised" },
  declined: { bg: "var(--danger-surface)", text: "var(--danger)", label: "Declined" }
};

function Row({ item, severity, interactive, onUpdateStatus, isUpdating }) {
  const isAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
  const isDeclined = item.approvalStatus === "declined";
  const total = Number(item.total_gbp ?? item.total ?? 0);
  const partsCost = Number(item.parts_gbp ?? item.partsCost ?? 0);
  const labourHours = Number(item.labour_hours ?? item.labourHours ?? 0);
  const labourRate = Number(item.labour_rate_gbp ?? 85);
  const labourCost = Number.isFinite(labourHours) ? labourHours * labourRate : 0;

  const detailLabel = item.label || item.sectionName || "Recorded item";
  const detailContent = item.concernText || item.notes || "";
  const measurement = item.measurement || "";
  const categoryLabel = item.categoryLabel || item.sectionName || "";

  // Green items are passing checks — only show description, no pricing or actions
  const isGreen = severity === "green";

  const originalSeverity = item.severityKey || item.rawSeverity;
  const rowBg =
    (isAuthorized || isDeclined)
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
        boxShadow: "inset 0 -1px 0 var(--separating-line)",
        background: rowBg,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div>
        {categoryLabel && (
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--txt-mute)"
            }}
          >
            {categoryLabel}
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--txt-bright)", marginTop: 2 }}>
          {detailLabel}
        </div>
        {detailContent && (
          <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 4 }}>
            {detailContent}
          </div>
        )}
        {measurement && (
          <div style={{ fontSize: 12, color: "var(--txt-mute)", marginTop: 4 }}>{measurement}</div>
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
            onClick={() => onUpdateStatus(item.id, isAuthorized ? null : "authorized")}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: isAuthorized ? "var(--success-surface)" : "var(--website-elev-2)",
              color: isAuthorized ? "var(--success)" : "var(--txt-bright)",
              fontWeight: 600,
              fontSize: 13,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isAuthorized ? "✓ Authorised" : "Authorise"}
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(item.id, isDeclined ? null : "declined")}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: isDeclined ? "var(--danger-surface)" : "var(--website-elev-2)",
              color: isDeclined ? "var(--danger)" : "var(--txt-bright)",
              fontWeight: 600,
              fontSize: 13,
              cursor: isUpdating ? "not-allowed" : "pointer",
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isDeclined ? "✗ Declined" : "Decline"}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, severity, interactive, onUpdateStatus, updatingIds }) {
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
      style={{
        borderRadius: "var(--radius-md)",
        background:
          severity === "authorized" || severity === "declined"
            ? "var(--website-elev-1)"
            : theme.bg,
        overflow: "hidden",
        marginBottom: 14
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          fontWeight: 700,
          color: theme.text,
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
        items.map((item) => (
          <Row
            key={`${severity}-${item.id}`}
            item={item}
            severity={severity}
            interactive={interactive}
            onUpdateStatus={onUpdateStatus}
            isUpdating={updatingIds?.has(item.id)}
          />
        ))
      )}
    </div>
  );
}

function TotalsGrid({ totals }) {
  const items = [
    { label: "Red Work", value: totals.red, color: "var(--danger)" },
    { label: "Amber Work", value: totals.amber, color: "var(--warning)" },
    { label: "Authorised", value: totals.authorized, color: "var(--success)" },
    { label: "Declined", value: totals.declined, color: "var(--txt-soft)" }
  ];
  return (
    <LayerSurface
      radius="var(--radius-md)"
      padding="14px"
      gap="10px"
      style={{ marginBottom: 14 }}
    >
      <div
        style={{
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
          gap: 8
        }}
      >
        {items.map((it) => (
          <LayerTheme
            key={it.label}
            radius="var(--radius-sm)"
            padding="12px"
            gap="4px"
            style={{ minHeight: 72 }}
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
          </LayerTheme>
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
  const tabs = useMemo(() => {
    const list = [{ id: "summary", label: "Summary" }];
    if (photoFiles.length > 0) list.push({ id: "photos", label: `Photos (${photoFiles.length})` });
    if (videoFiles.length > 0) list.push({ id: "videos", label: `Videos (${videoFiles.length})` });
    return list;
  }, [photoFiles.length, videoFiles.length]);

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
            padding: "10px 14px"
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
              marginLeft: -14,
              marginRight: -14,
              padding: "0 14px",
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
    </>
  );
}
