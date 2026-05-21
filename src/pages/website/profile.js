// file location: src/pages/website/profile.js
// Customer-facing portal page. Pulls one bundled payload from
// /api/website/profile (vehicles + jobs + invoices + appointments +
// account + payment methods + booking requests + service history +
// VHC summaries + activity timeline + messages) and surfaces it as a
// set of cards. Actions that need staff intervention (book service,
// pay invoice, request statement / PDF / data export / deletion,
// send a message) are written to public.customer_activity_events via
// /api/website/actions so existing staff workflows can pick them up.
//
// Styling: this page renders inside html.website-scope (applied by
// useWebsiteScope) so every raw <button>, <input>, <textarea>, <select>
// inherits the liquid-glass control system defined in custglobal.css.
// All card / row / badge / tracker / bubble chrome is done with inline
// styles that reuse the custglobal CSS variables (--txt-bright,
// --txt-soft, --txt-mute, --accentText, --accentMainRgb,
// --website-control-height, --website-field-gap) so the page stays
// consistent with the rest of /website without carrying its own
// stylesheet.

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/styles/themeProvider";
import { siteContent } from "@/singlescroll/data/siteContent";
import useWebsiteScope from "@/singlescroll/hooks/useWebsiteScope";
import WebsiteNativeSelect from "@/singlescroll/components/WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "@/singlescroll/components/WebsiteNativeDateTimeInput";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

// /website light/dark/system theme cycle. The choice is persisted to
// localStorage and applied by writing data-website-theme onto <html>;
// custglobal.css repaints the customer surface for whichever concrete
// theme is written. "system" is resolved to a real light/dark value
// here before the attribute is set, so the stylesheet only ever sees one
// of the two themes.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_CYCLE = ["light", "dark", "system"];

const resolveWebsiteTheme = (preference) => {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    return "dark";
  }
  return preference;
};

const getTrackerStages = (job) => {
  const stages = [
    { key: "booked", label: "Booked", reached: !!job.created_at },
    { key: "checked_in", label: "Checked in", reached: !!job.checked_in_at },
    { key: "in_workshop", label: "In workshop", reached: !!job.workshop_started_at },
  ];
  if (job.vhc_required) {
    stages.push({ key: "vhc", label: "VHC done", reached: !!job.vhc_completed_at });
  }
  const washDone =
    !!job.wash_completed_by ||
    (job.completed_at &&
      job.wash_started_at &&
      new Date(job.completed_at).getTime() >= new Date(job.wash_started_at).getTime());
  stages.push({ key: "wash", label: "Wash done", reached: washDone });
  const status = (job.status || "").toLowerCase();
  const ready =
    !!job.completed_at ||
    ["ready", "completed", "collected", "invoiced"].some((s) => status.includes(s));
  stages.push({ key: "ready", label: "Ready", reached: ready });
  return stages;
};

const getActiveStageIndex = (stages) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    if (stages[i].reached) return i;
  }
  return 0;
};

const humaniseActivity = (event) => {
  const t = (event.activity_type || "").replace(/_/g, " ");
  const payload = event.activity_payload || {};
  if (payload.summary) return payload.summary;
  if (payload.description) return payload.description;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "ownership", label: "Ownership" },
  { id: "tracker", label: "Tracker" },
  { id: "vehicles", label: "Vehicles" },
  { id: "jobs", label: "Jobs" },
  { id: "history", label: "History" },
  { id: "mot", label: "MOT" },
  { id: "recalls", label: "Recalls" },
  { id: "inspections", label: "Inspections" },
  { id: "vhc-extras", label: "VHC hub" },
  { id: "invoices", label: "Money" },
  { id: "payments-extras", label: "Payments" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "book", label: "Book" },
  { id: "services", label: "Services" },
  { id: "sell", label: "Sell" },
  { id: "showroom", label: "Showroom" },
  { id: "sales-hub", label: "Sales hub" },
  { id: "parts-hub", label: "Parts" },
  { id: "bodyshop", label: "Bodyshop" },
  { id: "valet", label: "Valet" },
  { id: "family", label: "Family" },
  { id: "self-service", label: "Self serve" },
  { id: "assistant", label: "Assistant" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const SERVICE_TYPES = [
  { id: "body_repair", title: "Body work", hint: "Dents, scratches, panel repair, paint.", action: "request_body_repair" },
  { id: "smart_repair", title: "SMART repair", hint: "Small / medium area repair — fast turnaround.", action: "request_smart_repair" },
  { id: "valet", title: "Valet", hint: "Mini, full or deep-clean valet packages.", action: "request_valet" },
  { id: "parts", title: "Parts", hint: "Genuine parts & accessories enquiry.", action: "request_parts_enquiry" },
  { id: "warranty", title: "Warranty claim", hint: "Open a claim against your manufacturer warranty.", action: "request_warranty_claim" },
  { id: "motability", title: "Motability", hint: "Motability scheme advice & applications.", action: "request_motability" },
  { id: "finance", title: "Finance quote", hint: "PCP, HP or lease quote on a vehicle.", action: "request_finance_quote" },
  { id: "test_drive", title: "Test drive", hint: "Book a test drive in a specific model.", action: "request_test_drive" },
];

// ── Inline style primitives ──────────────────────────────────────
// Card / row / chip backgrounds use the --website-elev-* tokens from
// custglobal.css instead of literal white washes, so they re-paint as
// faint dark washes when the light theme is active and stay visible on
// the pale surface. Body text uses --txt-bright for the same reason.
const cardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "clamp(16px, 3vw, 24px)",
  background: "var(--website-elev-1)",
  borderRadius: 18,
};
const cardWideStyle = { ...cardStyle, gridColumn: "1 / -1" };
const cardHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
const cardTitleStyle = { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 0.2, color: "var(--txt-bright)" };
const cardCountStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  background: "var(--website-elev-4)",
  color: "var(--txt-soft)",
};
const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  background: "var(--website-elev-3)",
  color: "var(--txt-soft)",
  whiteSpace: "nowrap",
};
const badgePaidStyle = { ...badgeStyle, background: "rgba(34, 197, 94, 0.18)", color: "#86efac" };
const badgeOpenStyle = { ...badgeStyle, background: "rgba(var(--accentMainRgb), 0.22)", color: "#fca5a5" };
const emptyStyle = { margin: 0, fontSize: 13, color: "var(--txt-mute)" };
const successStyle = { margin: 0, fontSize: 12, color: "#86efac" };
const errorStyle = { margin: 0, fontSize: 12, color: "#fca5a5" };
const itemListStyle = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const itemRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
};
const itemTitleStyle = { fontSize: 14, fontWeight: 600, color: "var(--txt-bright)" };
const itemMetaStyle = { fontSize: 12, color: "var(--txt-mute)", marginTop: 2 };
const formStyle = { display: "flex", flexDirection: "column", gap: "var(--website-field-gap)" };
const formRowStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--website-field-gap)" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "var(--website-field-gap)", minWidth: 0 };
const fieldLabelStyle = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--txt-mute)" };
const settingsRowStyle = { display: "flex", flexDirection: "column", gap: 12, paddingTop: 14, marginTop: 6 };
const settingsRowHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
const settingsTitleStyle = { fontSize: 14, fontWeight: 600, color: "var(--txt-bright)" };
const settingsHintStyle = { fontSize: 12, color: "var(--txt-mute)", margin: 0 };
const tagBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: "var(--website-elev-3)",
  color: "var(--txt-soft)",
};
const tagAccentStyle = { ...tagBaseStyle, background: "rgba(var(--accentMainRgb), 0.22)", color: "#fca5a5" };
const tagOkStyle = { ...tagBaseStyle, background: "rgba(34, 197, 94, 0.18)", color: "#86efac" };
const balanceHeroStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "16px 18px",
  borderRadius: 14,
  background: "var(--website-elev-2)",
};
const balanceFigureStyle = { fontSize: 28, fontWeight: 800, color: "var(--txt-bright)", letterSpacing: -0.5 };
const balanceMetaStyle = { fontSize: 12, color: "var(--txt-mute)" };
const detailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const detailFieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
};
const detailLabelStyle = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--txt-mute)" };
const detailValueStyle = { fontSize: 14, color: "var(--txt-bright)" };
const bubbleBase = { maxWidth: "80%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 4 };
const bubbleCustomerStyle = {
  ...bubbleBase,
  alignSelf: "flex-end",
  background: "linear-gradient(180deg, rgba(var(--accentMainRgb), 0.32) 0%, rgba(var(--accentMainRgb), 0.18) 100%)",
  color: "#fff",
};
const bubbleStaffStyle = {
  ...bubbleBase,
  alignSelf: "flex-start",
  background: "var(--website-elev-3)",
  color: "var(--txt-bright)",
};
const bubbleMetaStyle = { fontSize: 10, opacity: 0.75 };
const mediaGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 };
const mediaThumbStyle = {
  position: "relative",
  display: "block",
  aspectRatio: "4 / 3",
  borderRadius: 12,
  overflow: "hidden",
  background: "var(--website-elev-2)",
};
const mediaTagStyle = {
  position: "absolute",
  top: 8,
  left: 8,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  background: "rgba(0, 0, 0, 0.55)",
  color: "#fff",
};
const mediaCaptionStyle = {
  position: "absolute",
  left: 8,
  right: 8,
  bottom: 8,
  fontSize: 11,
  color: "#fff",
  textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)",
};
const timelineStyle = { display: "flex", flexDirection: "column", gap: 8 };
const timelineRowStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "baseline",
  gap: 14,
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--website-elev-1)",
};
const timelineWhenStyle = { fontSize: 11, color: "var(--txt-mute)", whiteSpace: "nowrap" };
const timelineWhatStyle = { fontSize: 13, color: "var(--txt-bright)" };
const stmtRowStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "baseline",
  gap: 14,
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 13,
};
const stmtMetaStyle = { fontSize: 11, color: "var(--txt-mute)" };
const cardChipStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
};
const cardBrandStyle = { fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" };
const cardLineStyle = { fontSize: 12, color: "var(--txt-soft)" };
const mileageListStyle = { display: "flex", flexDirection: "column", gap: 8 };
const mileageRowStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 12,
  fontSize: 12,
  color: "var(--txt-soft)",
};
const mileageBarStyle = {
  flex: 1,
  height: 6,
  borderRadius: 999,
  background: "var(--website-elev-4)",
  overflow: "hidden",
};
const mileageBarFillStyle = (pct) => ({
  display: "block",
  height: "100%",
  width: `${pct}%`,
  background: "linear-gradient(90deg, rgba(255,90,90,0.9), var(--accentText))",
});
const mileageValueStyle = { fontSize: 12, fontWeight: 700, color: "var(--txt-bright)", whiteSpace: "nowrap" };
const vhcLightStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background:
    tone === "red"
      ? "rgba(239, 68, 68, 0.18)"
      : tone === "amber"
      ? "rgba(245, 158, 11, 0.18)"
      : "rgba(34, 197, 94, 0.18)",
  color:
    tone === "red" ? "#fca5a5" : tone === "amber" ? "#fcd34d" : "#86efac",
});
const vhcDotStyle = (tone) => ({
  width: 8,
  height: 8,
  borderRadius: 999,
  background:
    tone === "red" ? "#ef4444" : tone === "amber" ? "#f59e0b" : "#22c55e",
});

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  marginBottom: 24,
};
const headerEyebrowStyle = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};
const headerTitleStyle = { margin: "6px 0 4px", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "var(--txt-bright)" };
const headerSubtitleStyle = { margin: 0, fontSize: 14, color: "var(--txt-soft)", maxWidth: 520 };
const headerActionsStyle = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)",
  gap: 24,
  alignItems: "start",
};
const sideNavStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  position: "sticky",
  top: 16,
  padding: 12,
  background: "var(--website-elev-1)",
  borderRadius: 14,
};
const sideNavHeadingStyle = {
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "var(--txt-mute)",
  padding: "4px 10px 8px",
};
const sideNavLinkStyle = {
  display: "block",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--txt-soft)",
  textDecoration: "none",
};
const contentStackStyle = { display: "flex", flexDirection: "column", gap: 18, minWidth: 0 };
const gridSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};
const trackerStepStyle = (state) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  color:
    state === "done"
      ? "var(--txt-bright)"
      : state === "active"
      ? "var(--accentText)"
      : "var(--txt-faint)",
  textAlign: "center",
});
const trackerDotStyle = (state) => ({
  width: 12,
  height: 12,
  borderRadius: 999,
  background:
    state === "done"
      ? "linear-gradient(180deg, rgba(255, 90, 90, 0.98), var(--accentText))"
      : state === "active"
      ? "var(--accentText)"
      : "var(--website-elev-4)",
});
const serviceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};
const serviceTileStyle = (active) => ({
  // Inline styles override the global pill chrome from custglobal.css
  // (button:not(.app-btn)) — service tiles need multi-line content,
  // left alignment and a square corner, not a 44px capsule.
  appearance: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 4,
  minHeight: 0,
  padding: "14px 16px",
  textAlign: "left",
  whiteSpace: "normal",
  letterSpacing: 0,
  textTransform: "none",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  color: "var(--txt-bright)",
  background: active
    ? "linear-gradient(180deg, rgba(var(--accentMainRgb), 0.32) 0%, rgba(var(--accentMainRgb), 0.18) 100%)"
    : "var(--website-elev-2)",
  WebkitBackdropFilter: "none",
  backdropFilter: "none",
  boxShadow: active
    ? "inset 0 0 0 1px rgba(var(--accentMainRgb), 0.5)"
    : "inset 0 0 0 1px var(--website-elev-3)",
  transition: "background 0.2s ease",
});
const serviceTileTitleStyle = { fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" };
const serviceTileHintStyle = { fontSize: 11, color: "var(--txt-mute)", lineHeight: 1.4 };
const toggleRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
  cursor: "pointer",
};
const toggleSwitchStyle = (checked) => ({
  position: "relative",
  width: 40,
  height: 22,
  borderRadius: 999,
  background: checked
    ? "linear-gradient(180deg, rgba(255, 90, 90, 0.98) 0%, var(--accentText) 100%)"
    : "var(--website-elev-4)",
  flexShrink: 0,
  transition: "background 0.2s ease",
});
const toggleKnobStyle = (checked) => ({
  position: "absolute",
  top: 2,
  left: checked ? 20 : 2,
  width: 18,
  height: 18,
  borderRadius: 999,
  background: "#fff",
  transition: "left 0.2s ease",
});

const PORTAL_DONE_STATUSES = ["delivered", "closed", "completed", "collected", "invoiced"];
const REPAIR_TIMELINE_STAGES = [
  { key: "booked", label: "Booked" },
  { key: "checked_in", label: "Checked in" },
  { key: "workshop", label: "Workshop" },
  { key: "vhc", label: "VHC" },
  { key: "wash", label: "Wash" },
  { key: "ready", label: "Ready" },
];
const VHC_PRESENTATION_LINKS = {
  preview: "/presentation/customer/vhc-customer-preview-jobNumber/3",
  customerView: "/presentation/customer/vhc-customer-view-jobNumber/4",
  share: "/presentation/customer/vhc-share-jobNumber-linkCode/5",
  customer: "/presentation/customer/vhc-customer-jobNumber-linkCode/6",
};
const ASSISTANT_SUGGESTIONS = [
  "When is my car next due?",
  "How much did my last service cost?",
  "What were my last VHC advisories?",
  "Book me a valet for Saturday morning.",
];

const portalSubHeaderStyle = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--accentText)",
};
const portalTileStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
};
const portalTodoStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  background: "var(--website-elev-2)",
};
const portalTodoTitleStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--accentText)",
};
const portalActionRowStyle = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const portalProgressStyle = {
  height: 8,
  borderRadius: 999,
  background: "var(--website-elev-4)",
  overflow: "hidden",
};
const portalProgressFillStyle = (pct) => ({
  height: "100%",
  width: `${Math.max(0, Math.min(100, pct))}%`,
  background: "linear-gradient(90deg, rgba(var(--accentMainRgb), 0.7), var(--accentText))",
});
const portalScoreRingStyle = (score) => ({
  width: 78,
  height: 78,
  borderRadius: "50%",
  background: `conic-gradient(var(--accentText) ${score * 3.6}deg, var(--website-elev-4) 0deg)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});
const portalScoreInnerStyle = {
  width: 62,
  height: 62,
  borderRadius: "50%",
  background: "var(--website-elev-1)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
const portalUploadPlaceholderStyle = {
  height: 110,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "0 8px",
  fontSize: 11,
  color: "var(--txt-mute)",
  background: "var(--website-elev-3)",
};
const portalMediaThumbStyle = {
  height: 72,
  width: 96,
  borderRadius: 10,
  overflow: "hidden",
  background: "var(--website-elev-3)",
  flexShrink: 0,
};

const portalIsOpenJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return !PORTAL_DONE_STATUSES.some((token) => status.includes(token)) && !job.completed_at;
};

const portalIsCompletedJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return PORTAL_DONE_STATUSES.some((token) => status.includes(token)) || Boolean(job.completed_at);
};

const portalVehicleTitle = (vehicle) =>
  vehicle.make_model ||
  vehicle.makeModel ||
  [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
  "Vehicle";

const portalVehicleReg = (vehicle) =>
  vehicle.reg_number || vehicle.reg || vehicle.registration || "Registration TBC";

const getHealthScore = (vehicle) => {
  let score = 100;
  const motDue = vehicle.mot_due || vehicle.motDue;
  if (motDue) {
    const days = daysUntil(motDue);
    if (Number.isFinite(days) && days < 0) score -= 35;
    else if (Number.isFinite(days) && days <= 30) score -= 20;
    else if (Number.isFinite(days) && days <= 60) score -= 10;
  }
  if (!vehicle.mileage) score -= 5;
  if (!vehicle.service_history && !vehicle.service_plan_type) score -= 8;
  return Math.max(0, Math.min(100, score));
};

const getProgressPct = (job) => {
  const checks = [
    job.created_at,
    job.checked_in_at,
    job.workshop_started_at,
    job.vhc_required ? job.vhc_completed_at : true,
    job.wash_started_at || job.wash_completed_by,
    job.completed_at,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const partTitle = (item) =>
  item.part_name_snapshot ||
  item.row_description ||
  item.description ||
  item.part?.name ||
  item.part?.part_number ||
  "Part";

const isBodyshopRequest = (request) =>
  /body|smart|paint|scratch|dent|repair/i.test(
    `${request.description || ""} ${request.confirmation_notes || ""}`,
  );

const isValetRequest = (request) =>
  /valet|detail|clean|wash/i.test(`${request.description || ""} ${request.confirmation_notes || ""}`);

function PortalCard({ id, eyebrow, title, count, action, todo, wide = false, children }) {
  return (
    <section id={id} style={wide ? cardWideStyle : cardStyle}>
      <div style={cardHeaderStyle}>
        <div>
          {eyebrow ? <div style={headerEyebrowStyle}>{eyebrow}</div> : null}
          <h2 style={cardTitleStyle}>{title}</h2>
        </div>
        <div style={portalActionRowStyle}>
          {count ? <span style={cardCountStyle}>{count}</span> : null}
          {action}
        </div>
      </div>
      {todo ? (
        <div style={portalTodoStyle}>
          <span style={portalTodoTitleStyle}>TODO · {todo.label}</span>
          {todo.detail ? <p style={emptyStyle}>{todo.detail}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PortalButtonLink({ href, children, style }) {
  return (
    <a className="app-btn" href={href} style={style}>
      {children}
    </a>
  );
}

function ScoreRing({ score = 0 }) {
  return (
    <div style={portalScoreRingStyle(score)}>
      <div style={portalScoreInnerStyle}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--txt-bright)" }}>{score}</span>
        <span style={{ fontSize: 9, color: "var(--txt-mute)", letterSpacing: 0.4, textTransform: "uppercase" }}>
          health
        </span>
      </div>
    </div>
  );
}

function DetailFieldGrid({ children }) {
  return <div style={detailGridStyle}>{children}</div>;
}

function NotificationDot({ enabled, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: enabled ? "var(--txt-bright)" : "var(--txt-mute)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: enabled ? "var(--accentText)" : "var(--website-elev-4)",
        }}
      />
      {label}
    </span>
  );
}

function MediaThumb({ item }) {
  const type = String(item.mime_type || item.media_type || "");
  const isVideo = type.startsWith("video") || type === "video";
  const url = item.public_url;
  return (
    <div style={portalMediaThumbStyle}>
      {url && isVideo ? (
        <video src={url} muted playsInline loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </div>
  );
}

function OwnershipDashboardCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="ownership"
      eyebrow="Ownership hub"
      title="Vehicle health overview"
      count={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
      todo={{
        label: "Recall API, tyre status and battery telemetry not linked yet",
        detail:
          "MOT, warranty, service plan and mileage are live. Recall, tyre and battery connections still require third-party APIs.",
      }}
    >
      {vehicles.length === 0 ? <p style={emptyStyle}>No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => (
          <div key={vehicle.vehicle_id || vehicle.id || portalVehicleReg(vehicle)} style={portalTileStyle}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={getHealthScore(vehicle)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={itemTitleStyle}>{portalVehicleTitle(vehicle)}</span>
                <span style={badgeStyle}>{portalVehicleReg(vehicle)}</span>
              </div>
            </div>
            <DetailFieldGrid>
              <DetailField label="MOT due" value={formatDate(vehicle.mot_due || vehicle.motDue)} />
              <DetailField
                label="Warranty"
                value={[vehicle.warranty_type, formatDate(vehicle.warranty_expiry)].filter(Boolean).join(" · ")}
              />
              <DetailField
                label="Service plan"
                value={[vehicle.service_plan_supplier, vehicle.service_plan_type, formatDate(vehicle.service_plan_expiry)]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <DetailField label="Fuel / gearbox" value={[vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(" · ")} />
              <DetailField label="Mileage" value={vehicle.mileage ? `${vehicle.mileage} miles` : null} />
            </DetailFieldGrid>
            <div>
              <h3 style={portalSubHeaderStyle}>Service notes</h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-bright)" }}>
                {vehicle.service_history || "No service-history note has been stored for this vehicle yet."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function LiveProgressTrackerCard({ jobs = [], customer }) {
  const active = (jobs || []).find(portalIsOpenJob);
  const contactPreference = String(customer?.contact_preference || "").toLowerCase();
  const smsEnabled = ["sms", "text", "phone"].includes(contactPreference) || Boolean(customer?.mobile);
  const emailEnabled = contactPreference === "email" || Boolean(customer?.email);

  return (
    <PortalCard id="tracker" eyebrow="Tracker" title="Live progress">
      {!active ? (
        <p style={emptyStyle}>No active workshop job is currently linked to this account.</p>
      ) : (
        <div style={portalTileStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span style={itemTitleStyle}>{active.job_number || active.id}</span>
            <span style={badgeOpenStyle}>{active.status || "Booked"}</span>
            {active.service_mode === "mobile" ? <span style={badgePaidStyle}>Mobile service</span> : null}
            {String(active.status || "").toLowerCase().includes("ready") ? <span style={badgePaidStyle}>Ready for collection</span> : null}
          </div>
          <div style={portalProgressStyle}>
            <div style={portalProgressFillStyle(getProgressPct(active))} />
          </div>
          <DetailFieldGrid>
            <DetailField label="Vehicle" value={active.vehicle_reg || active.vehicle_make_model} />
            <DetailField label="Job type" value={active.type || active.description} />
            <DetailField label="Service postcode" value={active.service_postcode} />
          </DetailFieldGrid>
          <div>
            <h3 style={portalSubHeaderStyle}>Notifications</h3>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              <NotificationDot enabled={smsEnabled} label="SMS" />
              <NotificationDot enabled={emailEnabled} label="Email" />
              <NotificationDot enabled={false} label="Push" />
            </div>
          </div>
        </div>
      )}
    </PortalCard>
  );
}

function RepairApprovalTimelineCard({ jobs = [], jobStatusHistory = [] }) {
  const job = jobs.find(portalIsOpenJob) || jobs[0];
  const history = job ? jobStatusHistory.filter((row) => row.job_id === job.id) : [];
  const events = {
    booked: job?.created_at,
    checked_in: job?.checked_in_at,
    workshop: job?.workshop_started_at,
    vhc: job?.vhc_completed_at,
    wash: job?.wash_started_at || job?.wash_completed_by,
    ready: job?.completed_at,
  };
  const activeIndex = Math.max(
    0,
    REPAIR_TIMELINE_STAGES.reduce((last, stage, index) => (events[stage.key] ? index : last), 0),
  );

  return (
    <PortalCard id="tracker-timeline" eyebrow="Live repair" title="Repair approval timeline">
      {!job ? (
        <p style={emptyStyle}>No job timeline is available for this account yet.</p>
      ) : (
        <div style={portalTileStyle}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={itemTitleStyle}>{job.job_number}</span>
            <span style={itemMetaStyle}>{[job.vehicle_make_model, job.vehicle_reg].filter(Boolean).join(" · ")}</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${REPAIR_TIMELINE_STAGES.length}, 1fr)`,
              gap: 12,
            }}
          >
            {REPAIR_TIMELINE_STAGES.map((stage, idx) => {
              const state = idx < activeIndex ? "done" : idx === activeIndex && events[stage.key] ? "active" : "todo";
              return (
                <div key={stage.key} style={trackerStepStyle(state)}>
                  <span style={trackerDotStyle(state)} />
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>
          <ul style={itemListStyle}>
            {REPAIR_TIMELINE_STAGES.map((stage) => {
              const matchingHistory = history.find((row) =>
                String(row.to_status || "").toLowerCase().includes(stage.key.replace("_", " ")),
              );
              return (
                <li key={stage.key} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{stage.label}</div>
                    {matchingHistory?.reason ? <div style={itemMetaStyle}>{matchingHistory.reason}</div> : null}
                  </div>
                  <span style={timelineWhenStyle}>{formatDateTime(events[stage.key] || matchingHistory?.changed_at) || "Pending"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PortalCard>
  );
}

function DigitalServiceHistoryCard({ jobs = [], jobHistory = [], invoices = [], vhcByJob = {} }) {
  const invoiceByJobNumber = new Map(invoices.map((invoice) => [String(invoice.job_number || ""), invoice]));
  const history = jobHistory.length
    ? jobHistory.map((row) => {
        const invoice = invoiceByJobNumber.get(String(row.job_number || ""));
        const vhc = vhcByJob?.[row.job_id] || {};
        return {
          id: row.history_id || row.job_id || row.job_number,
          date: row.recorded_at,
          mileage: row.mileage_at_service,
          type: row.status_snapshot || row.vehicle_make_model || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "—",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: row.vehicle_reg ? `${row.vehicle_reg} · ${row.vehicle_make_model || "vehicle"}` : null,
        };
      })
    : jobs.filter(portalIsCompletedJob).map((job) => {
        const invoice = invoiceByJobNumber.get(String(job.job_number || ""));
        const vhc = vhcByJob?.[job.id] || {};
        return {
          id: job.id || job.job_number,
          date: job.completed_at || job.updated_at || job.created_at,
          mileage: null,
          type: job.description || job.type || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "—",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: job.vehicle_reg ? `${job.vehicle_reg} · ${job.vehicle_make_model || "vehicle"}` : null,
        };
      });

  return (
    <PortalCard
      id="history"
      eyebrow="Service log"
      title="Digital service history"
      count={`${history.length} visit${history.length === 1 ? "" : "s"}`}
      action={<PortalButtonLink href="#messages">Request PDF</PortalButtonLink>}
    >
      {history.length === 0 ? (
        <p style={emptyStyle}>No completed service history has been recorded for this account yet.</p>
      ) : (
        <ul style={itemListStyle}>
          {history.map((visit) => (
            <li key={visit.id} style={itemRowStyle}>
              <div>
                <div style={itemTitleStyle}>{visit.type}</div>
                <div style={itemMetaStyle}>
                  {formatDate(visit.date)} · {visit.mileage ? `${visit.mileage} miles` : "mileage not recorded"} · {visit.invoice}
                </div>
                {visit.note ? <div style={{ ...itemMetaStyle, marginTop: 6 }}>{visit.note}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {visit.red > 0 ? <span style={badgeOpenStyle}>{visit.red} red</span> : null}
                {visit.amber > 0 ? <span style={badgeStyle}>{visit.amber} amber</span> : null}
                {visit.red === 0 && visit.amber === 0 ? <span style={badgePaidStyle}>No red/amber</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
}

function MotHistoryCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="mot"
      eyebrow="MOT record"
      title="MOT history"
      todo={{
        label: "DVLA MOT History API not linked yet",
        detail: "Stored MOT due dates are live. Full test history, advisories and failures still require the DVLA MOT History connection.",
      }}
    >
      {vehicles.length === 0 ? <p style={emptyStyle}>No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => {
          const days = daysUntil(vehicle.mot_due);
          const status = days == null ? "Unknown" : days < 0 ? "Overdue" : days <= 30 ? "Due soon" : "Current";
          return (
            <div key={vehicle.vehicle_id || vehicle.reg_number} style={portalTileStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={itemTitleStyle}>{portalVehicleTitle(vehicle)}</span>
                <span style={badgeStyle}>{portalVehicleReg(vehicle)}</span>
              </div>
              <ul style={itemListStyle}>
                <li style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>Current MOT due date</div>
                    <div style={itemMetaStyle}>{formatDate(vehicle.mot_due) || "Not recorded"}</div>
                  </div>
                  <span style={status === "Current" ? badgePaidStyle : badgeOpenStyle}>{status}</span>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </PortalCard>
  );
}

function RecallCheckerCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="recalls"
      eyebrow="Manufacturer alerts"
      title="Recall checker"
      todo={{ label: "Manufacturer / DVSA recall API not linked yet" }}
    >
      {vehicles.length === 0 ? <p style={emptyStyle}>No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => (
          <div key={vehicle.vehicle_id || vehicle.reg_number} style={portalTileStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={itemTitleStyle}>{portalVehicleTitle(vehicle)}</span>
              <span style={badgeStyle}>{portalVehicleReg(vehicle)}</span>
              {vehicle.vin ? <span style={itemMetaStyle}>VIN {vehicle.vin}</span> : null}
            </div>
            <p style={emptyStyle}>Recall status will appear here once the manufacturer / DVSA API connection is in place.</p>
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function VhcEnhancementsCard({ jobs = [], vhcByJob = {}, vhcDeclinations = [], vhcMedia = [], vhcShareLinks = [] }) {
  const [presentationMode, setPresentationMode] = useState(false);

  useEffect(() => {
    setPresentationMode(isPresentationMode());
  }, []);

  const getVhcSummary = (job) => vhcByJob[job.id] || vhcByJob[job.job_number];
  const jobsWithVhc = jobs.filter((job) => getVhcSummary(job));
  const latestJob = jobsWithVhc[0];
  const latestSummary = latestJob ? getVhcSummary(latestJob) : null;
  const latestShareLink = latestJob
    ? vhcShareLinks.find(
        (link) =>
          String(link.job_id || "") === String(latestJob.id || "") ||
          String(link.job_number || "") === String(latestJob.job_number || ""),
      )
    : null;
  const encodedJobNumber = encodeURIComponent(latestJob?.job_number || "");
  const encodedLinkCode = encodeURIComponent(latestShareLink?.link_code || "");
  const getRouteHref = (kind, liveHref) => (presentationMode ? VHC_PRESENTATION_LINKS[kind] : liveHref);
  const latestMedia = latestJob
    ? vhcMedia.filter((item) => item.job_number === latestJob.job_number).slice(0, 6)
    : vhcMedia.slice(0, 6);
  const declined = latestJob ? vhcDeclinations.filter((row) => row.job_id === latestJob.id) : vhcDeclinations;

  return (
    <PortalCard
      id="vhc-extras"
      eyebrow="Inspection"
      title="VHC hub"
      action={
        latestJob ? (
          <div style={portalActionRowStyle}>
            <PortalButtonLink href={getRouteHref("preview", `/vhc/customer-preview/${encodedJobNumber}`)}>Preview</PortalButtonLink>
            <PortalButtonLink href={getRouteHref("customerView", `/vhc/customer-view/${encodedJobNumber}`)}>Customer view</PortalButtonLink>
            {encodedLinkCode ? (
              <>
                <PortalButtonLink href={getRouteHref("share", `/vhc/share/${encodedJobNumber}/${encodedLinkCode}`)}>Share link</PortalButtonLink>
                <PortalButtonLink href={getRouteHref("customer", `/vhc/customer/${encodedJobNumber}/${encodedLinkCode}`)}>Customer link</PortalButtonLink>
              </>
            ) : null}
          </div>
        ) : null
      }
    >
      {!latestSummary ? (
        <p style={emptyStyle}>No live VHC is linked to this account yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={gridSplitStyle}>
            <div style={portalTileStyle}>
              <div style={balanceHeroStyle}>
                <span style={detailLabelStyle}>Authorised total this visit</span>
                <span style={balanceFigureStyle}>{formatCurrency(latestJob.vhc_authorized_total || 0)}</span>
              </div>
              <span style={itemMetaStyle}>
                {latestSummary.green || 0} green · {latestSummary.amber || 0} amber · {latestSummary.red || 0} red.
              </span>
            </div>
            <div style={portalTileStyle}>
              <h3 style={portalSubHeaderStyle}>Declined items to revisit</h3>
              {declined.length === 0 ? (
                <p style={emptyStyle}>Nothing declined on the linked VHC.</p>
              ) : (
                <ul style={itemListStyle}>
                  {declined.map((item) => (
                    <li key={item.vhc_id || `${item.job_id}-${item.issue_title}`} style={itemRowStyle}>
                      <div>
                        <div style={itemTitleStyle}>{item.issue_title || item.section || "VHC item"}</div>
                        {item.issue_description ? <div style={itemMetaStyle}>{item.issue_description}</div> : null}
                      </div>
                      <span style={badgeOpenStyle}>{item.display_status || item.approval_status || "Declined"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Ask us to re-quote</PortalButtonLink>
            </div>
          </div>
          <div style={portalTileStyle}>
            <h3 style={portalSubHeaderStyle}>Inspection media</h3>
            {latestMedia.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {latestMedia.map((item) => <MediaThumb key={item.id} item={item} />)}
              </div>
            ) : (
              <p style={emptyStyle}>Media will appear once the technician uploads customer-visible VHC photos or video.</p>
            )}
          </div>
        </div>
      )}
    </PortalCard>
  );
}

function InvoicesPaymentsExtrasCard({ invoicePayments = [], paymentPlans = [], transactions = [] }) {
  return (
    <PortalCard
      id="payments-extras"
      eyebrow="Account"
      title="Payments, finance & signatures"
      todo={{
        label: "Signature ledger not wired yet",
        detail:
          "Payment history, payment plans and account transactions are live where records exist. Digital signature capture still needs a customer-facing workflow.",
      }}
    >
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Payment history</h3>
        {invoicePayments.length === 0 ? (
          <p style={emptyStyle}>No invoice payments have been recorded for this account yet.</p>
        ) : (
          <ul style={itemListStyle}>
            {invoicePayments.map((payment) => (
              <li key={payment.payment_id} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{formatCurrency(payment.amount)} · {payment.payment_method || "Payment"}</div>
                  <div style={itemMetaStyle}>{formatDate(payment.payment_date)} · {payment.reference || "No reference"}</div>
                </div>
                <span style={badgePaidStyle}>Paid</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={gridSplitStyle}>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Payment plans</h3>
          {paymentPlans.length === 0 ? (
            <p style={emptyStyle}>No active payment plans are linked to this account.</p>
          ) : (
            <ul style={itemListStyle}>
              {paymentPlans.map((plan) => (
                <li key={plan.plan_id} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{plan.name || plan.description || "Payment plan"}</div>
                    <div style={itemMetaStyle}>{formatCurrency(plan.balance_due)} balance · next {formatDate(plan.next_payment_date)}</div>
                  </div>
                  <span style={String(plan.status).toLowerCase() === "active" ? badgePaidStyle : badgeStyle}>{plan.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Digital signatures</h3>
          <p style={emptyStyle}>Digital signature records will appear once the signature ledger is connected.</p>
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Account statement</h3>
          {transactions.length === 0 ? (
            <p style={emptyStyle}>No account transactions are linked to this account.</p>
          ) : (
            <ul style={itemListStyle}>
              {transactions.slice(0, 5).map((transaction) => (
                <li key={transaction.transaction_id} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{transaction.description || transaction.type}</div>
                    <div style={itemMetaStyle}>{formatDate(transaction.transaction_date)} · {transaction.job_number || "Account"}</div>
                  </div>
                  <span style={badgeStyle}>{formatCurrency(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Request full statement</PortalButtonLink>
        </div>
      </div>
    </PortalCard>
  );
}

function DocumentsCentreCard({ invoices = [], vhcMedia = [] }) {
  const docs = [
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.invoice_id || invoice.id}`,
      name: invoice.invoice_number || invoice.invoice_id || "Invoice",
      meta: `Invoice · ${formatDate(invoice.created_at)} · ${invoice.payment_status || "Draft"}`,
      href: invoice.invoice_id ? `/accounts/invoices/${invoice.invoice_id}` : null,
    })),
    ...vhcMedia.map((item) => ({
      id: `media-${item.id}`,
      name: item.context_label || `${item.media_type || "VHC"} media`,
      meta: `Inspection media · ${formatDate(item.created_at)}`,
      href: item.public_url,
    })),
  ];

  return (
    <PortalCard
      id="documents"
      eyebrow="Files"
      title="Documents centre"
      action={<PortalButtonLink href="#messages">Request upload</PortalButtonLink>}
      todo={{
        label: "Customer documents API + upload endpoint not wired yet",
        detail: "Invoices and VHC media are live. Customer-uploaded documents still need a customer-scoped index and upload route.",
      }}
    >
      <div style={portalTileStyle}>
        {docs.length === 0 ? (
          <p style={emptyStyle}>No invoice or VHC media documents are linked to this account yet.</p>
        ) : (
          <ul style={itemListStyle}>
            {docs.map((doc) => (
              <li key={doc.id} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{doc.name}</div>
                  <div style={itemMetaStyle}>{doc.meta}</div>
                </div>
                {doc.href ? <PortalButtonLink href={doc.href}>Open</PortalButtonLink> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Upload zone</h3>
        <div style={{ ...portalUploadPlaceholderStyle, height: "auto", minHeight: 88 }}>
          Customer uploads will appear here once the upload endpoint is connected.
        </div>
      </div>
    </PortalCard>
  );
}

function SalesShowroomCard() {
  return (
    <PortalCard
      id="sales-hub"
      eyebrow="Sales"
      title="Showroom & orders"
      todo={{ label: "Customer-side sales tables for watchlists, reservations, PX and orders not built yet" }}
    >
      <div style={gridSplitStyle}>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Saved cars & price alerts</h3>
          <p style={emptyStyle}>Saved cars will appear here once the customer watchlist table is connected.</p>
          <PortalButtonLink href="/website#cars" style={{ alignSelf: "flex-start" }}>Browse cars</PortalButtonLink>
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Reservations and orders</h3>
          <p style={emptyStyle}>Reservations, vehicle orders and delivery countdowns will appear once customer sales records are available.</p>
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Part-exchange offers</h3>
          <p style={emptyStyle}>Part-exchange valuations will appear once the sales enquiry workflow is linked to the portal.</p>
        </div>
      </div>
    </PortalCard>
  );
}

function PartsPortalExtrasCard({ partsJobItems = [], partsRequests = [], partsOrderCards = [] }) {
  return (
    <PortalCard
      id="parts-hub"
      eyebrow="Parts"
      title="Parts portal"
      todo={{
        label: "VIN-driven parts catalogue and accessory upsell API not wired yet",
        detail: "Job parts, parts requests and order cards are live where records exist. VIN fitment and accessory recommendations still require a catalogue API.",
      }}
    >
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>VIN lookup</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Enter VIN or registration" disabled style={{ flex: "1 1 220px", minWidth: 0 }} />
          <button type="button">Find parts</button>
        </div>
      </div>
      <div style={gridSplitStyle}>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Job parts</h3>
          {partsJobItems.length === 0 ? (
            <p style={emptyStyle}>No job parts are currently linked to this account.</p>
          ) : (
            <ul style={itemListStyle}>
              {partsJobItems.slice(0, 8).map((item) => (
                <li key={item.id} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{partTitle(item)}</div>
                    <div style={itemMetaStyle}>Qty {item.quantity_requested || 1} · ETA {formatDate(item.eta_date) || "TBC"}</div>
                  </div>
                  <span style={String(item.status).includes("fitted") ? badgePaidStyle : badgeOpenStyle}>{item.status || "Pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Parts requests</h3>
          {partsRequests.length === 0 ? (
            <p style={emptyStyle}>No parts requests are awaiting action.</p>
          ) : (
            <ul style={itemListStyle}>
              {partsRequests.slice(0, 8).map((request) => (
                <li key={request.request_id} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{partTitle(request)}</div>
                    <div style={itemMetaStyle}>Qty {request.quantity || 1} · {formatDate(request.updated_at || request.created_at) || "TBC"}</div>
                  </div>
                  <span style={String(request.status).includes("approved") ? badgePaidStyle : badgeOpenStyle}>{request.status || "Pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Order tracking</h3>
        {partsOrderCards.length === 0 ? (
          <p style={emptyStyle}>No customer parts orders are linked to this account.</p>
        ) : (
          <ul style={itemListStyle}>
            {partsOrderCards.slice(0, 8).map((order) => (
              <li key={order.id} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{order.order_number || "Parts order"}</div>
                  <div style={itemMetaStyle}>
                    {order.vehicle_reg || "Vehicle TBC"} · ETA {formatDate(order.delivery_eta) || "TBC"}
                    {order.delivery_window ? ` · ${order.delivery_window}` : ""}
                  </div>
                </div>
                <span style={String(order.delivery_status).includes("delivered") ? badgePaidStyle : badgeOpenStyle}>
                  {order.delivery_status || order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function SmartRepairCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isBodyshopRequest);
  return (
    <PortalCard
      id="bodyshop"
      eyebrow="Bodyshop"
      title="SMART repair & estimates"
      todo={{ label: "Bodyshop estimate workflow and before/after media bucket not wired yet" }}
    >
      <div style={portalTileStyle}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
          Send us photos of scuffs, scratches or dents and we'll respond from the workshop workflow.
        </p>
        <div style={gridSplitStyle}>
          <div style={portalUploadPlaceholderStyle}>Upload connection required</div>
          <div style={portalUploadPlaceholderStyle}>Upload connection required</div>
          <div style={portalUploadPlaceholderStyle}>Upload connection required</div>
        </div>
        <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Request estimate</PortalButtonLink>
      </div>
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Repair requests</h3>
        {requests.length === 0 ? (
          <p style={emptyStyle}>No bodyshop or SMART repair requests are currently linked to this account.</p>
        ) : (
          <ul style={itemListStyle}>
            {requests.map((request) => (
              <li key={request.request_id} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{request.description || "Repair request"}</div>
                  <div style={itemMetaStyle}>{formatDate(request.submitted_at)}</div>
                </div>
                <span style={badgeOpenStyle}>{request.status || "Pending"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function ValetDetailingCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isValetRequest);
  return (
    <PortalCard
      id="valet"
      eyebrow="Valeting"
      title="Valet & detailing"
      todo={{ label: "Valet packages and subscription model not in schema yet" }}
    >
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Your subscription</h3>
        <p style={emptyStyle}>No valet subscription is linked to this account.</p>
      </div>
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Valet requests</h3>
        {requests.length === 0 ? (
          <p style={emptyStyle}>No valet or detailing requests are currently linked to this account.</p>
        ) : (
          <ul style={itemListStyle}>
            {requests.map((request) => (
              <li key={request.request_id} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{request.description || "Valet request"}</div>
                  <div style={itemMetaStyle}>{formatDate(request.submitted_at)}</div>
                </div>
                <span style={badgeOpenStyle}>{request.status || "Pending"}</span>
              </li>
            ))}
          </ul>
        )}
        <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Ask about valet options</PortalButtonLink>
      </div>
    </PortalCard>
  );
}

function FamilyGarageCard({ customer, vehicles = [] }) {
  const customerName =
    [customer?.firstname, customer?.lastname].filter(Boolean).join(" ") ||
    customer?.name ||
    customer?.email ||
    "Account holder";

  return (
    <PortalCard
      id="family"
      eyebrow="Household"
      title="Family & shared garage"
      action={<PortalButtonLink href="#messages">Request shared access</PortalButtonLink>}
      todo={{ label: "Shared accounts / household schema not built yet" }}
    >
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Members</h3>
        <ul style={itemListStyle}>
          <li style={itemRowStyle}>
            <div>
              <div style={itemTitleStyle}>{customerName}</div>
              <div style={itemMetaStyle}>
                {customer?.email || "No email stored"} · {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              </div>
            </div>
            <span style={badgePaidStyle}>Owner</span>
          </li>
        </ul>
      </div>
      <div style={portalTileStyle}>
        <h3 style={portalSubHeaderStyle}>Shared vehicles</h3>
        {vehicles.length === 0 ? (
          <p style={emptyStyle}>No vehicles are linked to this account yet.</p>
        ) : (
          <ul style={itemListStyle}>
            {vehicles.map((vehicle) => (
              <li key={vehicle.vehicle_id || vehicle.reg_number} style={itemRowStyle}>
                <div>
                  <div style={itemTitleStyle}>{portalVehicleReg(vehicle)}</div>
                  <div style={itemMetaStyle}>{portalVehicleTitle(vehicle)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function SelfServiceToolsCard({ vehicles = [], vhcDeclinations = [] }) {
  const servicePlans = vehicles.filter(
    (vehicle) => vehicle.service_plan_supplier || vehicle.service_plan_type || vehicle.service_plan_expiry,
  );

  return (
    <PortalCard
      id="self-service"
      eyebrow="Self service"
      title="Reminders, plans & loyalty"
      todo={{
        label: "Seasonal reminders and loyalty programme not in schema yet",
        detail:
          "Service-plan fields and VHC advisory reminders are live where records exist. Seasonal reminder automation and loyalty still require tables/workflows.",
      }}
    >
      <div style={gridSplitStyle}>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Seasonal reminders</h3>
          <p style={emptyStyle}>Seasonal reminders will appear once reminder rules are connected.</p>
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Service plans</h3>
          {servicePlans.length === 0 ? (
            <p style={emptyStyle}>No service plan is linked to your vehicles.</p>
          ) : (
            <ul style={itemListStyle}>
              {servicePlans.map((vehicle) => (
                <li key={vehicle.vehicle_id || vehicle.reg_number} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>
                      {[vehicle.service_plan_supplier, vehicle.service_plan_type].filter(Boolean).join(" · ") || "Service plan"}
                    </div>
                    <div style={itemMetaStyle}>{portalVehicleReg(vehicle)} · expires {formatDate(vehicle.service_plan_expiry) || "Not recorded"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Loyalty & referral</h3>
          <p style={emptyStyle}>Loyalty points and referral rewards will appear once the programme schema is connected.</p>
          <PortalButtonLink href="#settings" style={{ alignSelf: "flex-start" }}>Refer a friend</PortalButtonLink>
        </div>
        <div style={portalTileStyle}>
          <h3 style={portalSubHeaderStyle}>Advisory reminders</h3>
          {vhcDeclinations.length === 0 ? (
            <p style={emptyStyle}>No declined VHC advisories are waiting to be revisited.</p>
          ) : (
            <ul style={itemListStyle}>
              {vhcDeclinations.slice(0, 5).map((item) => (
                <li key={item.vhc_id || `${item.job_id}-${item.issue_title}`} style={itemRowStyle}>
                  <div>
                    <div style={itemTitleStyle}>{item.issue_title || item.section || "VHC advisory"}</div>
                    <div style={itemMetaStyle}>{item.issue_description || item.customer_description}</div>
                  </div>
                  <span style={badgeOpenStyle}>Revisit</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PortalCard>
  );
}

function AiAssistantCard() {
  const [draft, setDraft] = useState("");
  return (
    <PortalCard
      id="assistant"
      eyebrow="Help"
      title="Ownership assistant"
      todo={{ label: "Customer-facing AI assistant endpoint not wired yet" }}
    >
      <div style={portalTileStyle}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
          Ask anything about your vehicle, history or upcoming visits. The assistant will be wired up to live data soon.
        </p>
        <div style={portalActionRowStyle}>
          {ASSISTANT_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => setDraft(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Type a question..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 0 }}
          />
          <button type="button">Ask</button>
        </div>
      </div>
    </PortalCard>
  );
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { setTemporaryOverride } = useTheme();
  useWebsiteScope();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstname: "",
    lastname: "",
    mobile: "",
    telephone: "",
    address: "",
    postcode: "",
    contact_preference: "email",
  });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionFlash, setActionFlash] = useState({});
  // Theme cycle preference: "light" | "dark" | "system". Defaults to dark
  // (the historic /website look) until the stored choice loads on mount.
  const [websiteThemePref, setWebsiteThemePref] = useState("dark");

  useEffect(() => {
    // Force dark mode + red accent for the whole /website/profile experience.
    // The setAttribute is applied immediately (no wait for the themeProvider
    // effect cycle) so there is no flash of the user's previous theme on
    // navigation. setTemporaryOverride then writes the red-accent CSS vars
    // via the provider, and the cleanup restores the user's preference on
    // navigation away.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    setTemporaryOverride({ mode: "dark", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  // Load the saved /website theme preference once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_CYCLE.includes(stored)) {
      setWebsiteThemePref(stored);
    }
  }, []);

  // Apply the resolved theme to <html> via data-website-theme, and when
  // the preference is "system" keep it in sync with the OS scheme. The
  // attribute is removed on navigation away so other /website pages keep
  // their dark default.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const apply = () => {
      document.documentElement.setAttribute(
        "data-website-theme",
        resolveWebsiteTheme(websiteThemePref),
      );
    };
    apply();
    let media;
    if (websiteThemePref === "system" && window.matchMedia) {
      media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", apply);
    }
    return () => {
      if (media) media.removeEventListener("change", apply);
      document.documentElement.removeAttribute("data-website-theme");
    };
  }, [websiteThemePref]);

  const cycleWebsiteTheme = () => {
    setWebsiteThemePref((prev) => {
      const idx = WEBSITE_THEME_CYCLE.indexOf(prev);
      const next = WEBSITE_THEME_CYCLE[(idx + 1) % WEBSITE_THEME_CYCLE.length];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WEBSITE_THEME_KEY, next);
      }
      return next;
    });
  };

  const refresh = () =>
    fetch("/api/website/profile", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/website/login");
          return null;
        }
        return r.json();
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload.success) {
          setStatus("error");
          return;
        }
        setData(payload);
        setEditForm({
          firstname: payload.customer.firstname || "",
          lastname: payload.customer.lastname || "",
          mobile: payload.customer.mobile || "",
          telephone: payload.customer.telephone || "",
          address: payload.customer.address || "",
          postcode: payload.customer.postcode || "",
          contact_preference: payload.customer.contact_preference || "email",
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (key, message) => {
    setActionFlash((prev) => ({ ...prev, [key]: message }));
    setTimeout(() => {
      setActionFlash((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3500);
  };

  const handleLogout = async () => {
    await fetch("/api/website/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    router.replace("/website");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/website/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editForm),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || "Could not save profile.");
      }
      setData((prev) =>
        prev ? { ...prev, customer: { ...prev.customer, ...payload.customer } } : prev,
      );
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const callAction = async (action, payload, flashKey, flashMessage) => {
    try {
      const res = await fetch("/api/website/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, payload }),
      });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "Failed.");
      if (flashKey) flash(flashKey, flashMessage || "Request sent — we'll be in touch.");
      refresh();
    } catch (err) {
      if (flashKey) flash(flashKey, err.message);
    }
  };

  const customer = data?.customer;
  const vehicles = useMemo(() => data?.vehicles || [], [data?.vehicles]);
  const jobs = useMemo(() => data?.jobs || [], [data?.jobs]);
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const appointments = useMemo(() => data?.appointments || [], [data?.appointments]);
  const accounts = useMemo(() => data?.accounts || [], [data?.accounts]);
  const paymentMethods = useMemo(() => data?.paymentMethods || [], [data?.paymentMethods]);
  const bookingRequests = useMemo(() => data?.bookingRequests || [], [data?.bookingRequests]);
  const jobHistory = useMemo(() => data?.jobHistory || [], [data?.jobHistory]);
  const vhcByJob = useMemo(() => data?.vhcByJob || {}, [data?.vhcByJob]);
  const vhcDeclinations = useMemo(() => data?.vhcDeclinations || [], [data?.vhcDeclinations]);
  const vhcMedia = useMemo(() => data?.vhcMedia || [], [data?.vhcMedia]);
  const transactions = useMemo(() => data?.transactions || [], [data?.transactions]);
  const jobStatusHistory = useMemo(() => data?.jobStatusHistory || [], [data?.jobStatusHistory]);
  const invoicePayments = useMemo(() => data?.invoicePayments || [], [data?.invoicePayments]);
  const paymentPlans = useMemo(() => data?.paymentPlans || [], [data?.paymentPlans]);
  const partsJobItems = useMemo(() => data?.partsJobItems || [], [data?.partsJobItems]);
  const partsRequests = useMemo(() => data?.partsRequests || [], [data?.partsRequests]);
  const partsOrderCards = useMemo(() => data?.partsOrderCards || [], [data?.partsOrderCards]);
  const timeline = useMemo(() => data?.timeline || [], [data?.timeline]);
  const messages = useMemo(() => data?.messages || [], [data?.messages]);

  const fullName = useMemo(() => {
    if (!customer) return "";
    return (
      [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
      customer.name ||
      customer.email ||
      "Your account"
    );
  }, [customer]);

  const outstandingInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          !(
            i.paid === true ||
            (i.payment_status || "").toLowerCase() === "paid"
          ),
      ),
    [invoices],
  );
  const outstandingTotal = useMemo(
    () =>
      outstandingInvoices.reduce(
        (sum, i) => sum + Number(i.grand_total ?? i.total ?? 0),
        0,
      ),
    [outstandingInvoices],
  );

  const motSoonest = useMemo(() => {
    let best = null;
    for (const v of vehicles) {
      const days = daysUntil(v.mot_due);
      if (days == null) continue;
      if (!best || days < best.days) best = { vehicle: v, days };
    }
    return best;
  }, [vehicles]);

  const serviceDue = useMemo(() => {
    const lastByVehicle = new Map();
    for (const h of jobHistory) {
      if (!h.vehicle_reg) continue;
      if (!lastByVehicle.has(h.vehicle_reg)) {
        lastByVehicle.set(h.vehicle_reg, h);
      }
    }
    for (const v of vehicles) {
      const last = v.reg_number ? lastByVehicle.get(v.reg_number) : null;
      if (!last) continue;
      const monthsSince =
        (Date.now() - new Date(last.recorded_at).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 11) {
        return { vehicle: v, last, months: Math.round(monthsSince) };
      }
    }
    return null;
  }, [jobHistory, vehicles]);

  const activeJob = useMemo(() => {
    return (
      jobs.find((j) => {
        const s = (j.status || "").toLowerCase();
        return !s.includes("completed") && !s.includes("collected");
      }) || jobs[0]
    );
  }, [jobs]);

  const mileageRows = useMemo(() => {
    const max = Math.max(
      1,
      ...jobHistory
        .map((h) => Number(h.mileage_at_service))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    return jobHistory
      .filter((h) => Number(h.mileage_at_service) > 0)
      .slice(0, 10)
      .map((h) => ({
        ...h,
        pct: Math.min(100, (Number(h.mileage_at_service) / max) * 100),
      }));
  }, [jobHistory]);

  return (
    <>
      <Head>
        <title>{`Your account - ${siteContent.brand.name}`}</title>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-theme','dark');",
          }}
        />
      </Head>
      <div
        style={{
          minHeight: "100vh",
          padding: "clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px) 96px",
          color: "var(--txt-bright)",
        }}
      >
        <main style={{ maxWidth: 1280, margin: "0 auto" }}>
          {status === "loading" ? (
            <p style={{ fontSize: 14, color: "var(--txt-soft)" }}>
              Loading your account…
            </p>
          ) : status === "error" || !customer ? (
            <p style={{ fontSize: 14, color: "var(--txt-soft)" }}>
              Could not load your account.{" "}
              <Link href="/website/login" style={{ color: "var(--accentText)" }}>
                Sign in again
              </Link>
              .
            </p>
          ) : (
            <>
              <header style={headerStyle}>
                <div>
                  <span style={headerEyebrowStyle}>Customer portal</span>
                  <h1 style={headerTitleStyle}>Hello, {fullName}</h1>
                  <p style={headerSubtitleStyle}>
                    Your vehicles, jobs, invoices, messages and account
                    settings — all in one place.
                  </p>
                </div>
                <div style={headerActionsStyle}>
                  <button
                    type="button"
                    onClick={cycleWebsiteTheme}
                    aria-label={`Theme: ${websiteThemePref}. Click to cycle light, dark, system.`}
                  >
                    {`Theme: ${websiteThemePref.charAt(0).toUpperCase()}${websiteThemePref.slice(1)}`}
                  </button>
                  <Link href="/website" role="button">
                    Back to site
                  </Link>
                  <button type="button" className="app-btn" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </header>

              <div style={layoutStyle}>
                <aside style={sideNavStyle} aria-label="Sections">
                  <span style={sideNavHeadingStyle}>Jump to</span>
                  {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`} style={sideNavLinkStyle}>
                      {s.label}
                    </a>
                  ))}
                </aside>

                <div style={contentStackStyle}>
                  {/* ───────── Summary banners ───────── */}
                  <div id="summary" style={gridSplitStyle}>
                    {motSoonest ? (
                      <section
                        className="website-banner"
                        style={{
                          gridColumn: "1 / -1",
                          flexDirection: "column",
                          alignItems: "stretch",
                          minHeight: 0,
                          padding: 16,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>
                            {motSoonest.days < 0
                              ? `MOT overdue on ${motSoonest.vehicle.reg_number}`
                              : `MOT due in ${motSoonest.days} day${motSoonest.days === 1 ? "" : "s"} — ${motSoonest.vehicle.reg_number}`}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
                            Expires {formatDate(motSoonest.vehicle.mot_due)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            callAction(
                              "book_service",
                              {
                                description: `MOT booking request for ${motSoonest.vehicle.reg_number}`,
                                vehicle_id: motSoonest.vehicle.vehicle_id,
                              },
                              "mot",
                              "MOT request sent — we'll confirm by email.",
                            )
                          }
                        >
                          Book MOT
                        </button>
                        {actionFlash.mot ? (
                          <p style={successStyle}>{actionFlash.mot}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {serviceDue ? (
                      <section
                        className="website-banner"
                        style={{
                          gridColumn: "1 / -1",
                          flexDirection: "column",
                          alignItems: "stretch",
                          minHeight: 0,
                          padding: 16,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>
                            Service due — {serviceDue.vehicle.reg_number}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
                            Last service {serviceDue.months} months ago.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            callAction(
                              "book_service",
                              {
                                description: `Service booking request for ${serviceDue.vehicle.reg_number}`,
                                vehicle_id: serviceDue.vehicle.vehicle_id,
                              },
                              "svc",
                              "Service request sent — we'll be in touch.",
                            )
                          }
                        >
                          Book service
                        </button>
                        {actionFlash.svc ? (
                          <p style={successStyle}>{actionFlash.svc}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {/* Live job tracker */}
                    {activeJob ? (
                      <section style={cardWideStyle}>
                        <div style={cardHeaderStyle}>
                          <h2 style={cardTitleStyle}>
                            Live status — {activeJob.job_number || `Job #${activeJob.id}`}
                          </h2>
                          <span style={badgeStyle}>{activeJob.status || "—"}</span>
                        </div>
                        <p style={{ ...itemMetaStyle, margin: 0 }}>
                          {[activeJob.vehicle_reg, activeJob.vehicle_make_model]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <ActiveJobTags
                          job={activeJob}
                          bookingRequest={bookingRequests.find(
                            (r) => r.job_id === activeJob.id,
                          )}
                          vhcSent={
                            (data.vhcSendHistory || []).find(
                              (s) => s.job_id === activeJob.id,
                            ) || null
                          }
                        />
                        {(() => {
                          const stages = getTrackerStages(activeJob);
                          const active = getActiveStageIndex(stages);
                          return (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${stages.length}, 1fr)`,
                                gap: 12,
                                marginTop: 6,
                              }}
                            >
                              {stages.map((stage, idx) => {
                                const state =
                                  idx < active
                                    ? "done"
                                    : idx === active && stage.reached
                                    ? "active"
                                    : "todo";
                                return (
                                  <div key={stage.key} style={trackerStepStyle(state)}>
                                    <span style={trackerDotStyle(state)} />
                                    <span>{stage.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </section>
                    ) : null}
                  </div>

                  {/* ───────── Personal details ───────── */}
                  <section style={cardWideStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Personal details</h2>
                      {!editing ? (
                        <button type="button" onClick={() => setEditing(true)}>
                          Edit
                        </button>
                      ) : null}
                    </div>

                    {editing ? (
                      <form style={formStyle} onSubmit={handleSaveProfile}>
                        {saveError ? <p style={errorStyle}>{saveError}</p> : null}
                        <div style={formRowStyle}>
                          <FieldInput
                            label="First name"
                            value={editForm.firstname}
                            onChange={(v) => setEditForm({ ...editForm, firstname: v })}
                          />
                          <FieldInput
                            label="Last name"
                            value={editForm.lastname}
                            onChange={(v) => setEditForm({ ...editForm, lastname: v })}
                          />
                        </div>
                        <div style={formRowStyle}>
                          <FieldInput
                            label="Mobile"
                            value={editForm.mobile}
                            onChange={(v) => setEditForm({ ...editForm, mobile: v })}
                          />
                          <FieldInput
                            label="Telephone"
                            value={editForm.telephone}
                            onChange={(v) => setEditForm({ ...editForm, telephone: v })}
                          />
                        </div>
                        <FieldInput
                          label="Address"
                          value={editForm.address}
                          onChange={(v) => setEditForm({ ...editForm, address: v })}
                        />
                        <div style={formRowStyle}>
                          <FieldInput
                            label="Postcode"
                            value={editForm.postcode}
                            onChange={(v) => setEditForm({ ...editForm, postcode: v })}
                          />
                          <div style={fieldStyle}>
                            <label style={fieldLabelStyle}>Contact preference</label>
                            <WebsiteNativeSelect
                              value={editForm.contact_preference}
                              onChange={(value) =>
                                setEditForm({ ...editForm, contact_preference: value })
                              }
                              options={[
                                { value: "email", label: "Email" },
                                { value: "phone", label: "Phone" },
                                { value: "sms", label: "SMS" },
                                { value: "post", label: "Post" },
                              ]}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="submit"
                            className="app-btn"
                            disabled={saving}
                            style={{ flex: 1, minWidth: 160 }}
                          >
                            {saving ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(false);
                              setSaveError("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={detailGridStyle}>
                        <DetailField label="Name" value={fullName} />
                        <DetailField label="Email" value={customer.email} />
                        <DetailField label="Mobile" value={customer.mobile} />
                        <DetailField label="Telephone" value={customer.telephone} />
                        <DetailField label="Address" value={customer.address} />
                        <DetailField label="Postcode" value={customer.postcode} />
                        <DetailField
                          label="Preferred contact"
                          value={customer.contact_preference}
                        />
                      </div>
                    )}
                  </section>

                  {/* ───────── Vehicles ───────── */}
                  <section id="vehicles" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Your vehicles</h2>
                      <span style={cardCountStyle}>{vehicles.length}</span>
                    </div>
                    {vehicles.length === 0 ? (
                      <p style={emptyStyle}>
                        No vehicles linked to your account yet. Get in touch and we'll
                        add them.
                      </p>
                    ) : (
                      <ul style={itemListStyle}>
                        {vehicles.map((v) => {
                          const motDays = daysUntil(v.mot_due);
                          const warrantyDays = daysUntil(v.warranty_expiry);
                          return (
                            <li
                              key={v.vehicle_id}
                              style={{ ...itemRowStyle, gridTemplateColumns: "1fr" }}
                            >
                              <div>
                                <div style={itemTitleStyle}>
                                  {v.reg_number || "—"} ·{" "}
                                  {[v.make, v.model].filter(Boolean).join(" ") ||
                                    "Vehicle"}
                                </div>
                                <div style={itemMetaStyle}>
                                  {[
                                    v.year && `${v.year}`,
                                    v.colour,
                                    v.fuel_type,
                                    v.transmission,
                                    v.mileage && `${v.mileage} mi`,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                                <div style={{ ...itemMetaStyle, marginTop: 6 }}>
                                  {v.mot_due
                                    ? `MOT ${motDays != null && motDays < 0 ? `overdue (${formatDate(v.mot_due)})` : `due ${formatDate(v.mot_due)}`}`
                                    : "MOT date on file: —"}
                                  {v.warranty_expiry
                                    ? ` · Warranty ${warrantyDays != null && warrantyDays < 0 ? "expired" : `until ${formatDate(v.warranty_expiry)}`}`
                                    : ""}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  {/* Add vehicle + update mileage */}
                  <section style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Update your vehicles</h2>
                    </div>
                    <UpdateMileageRow
                      vehicles={vehicles}
                      onSaved={() => {
                        flash("mileage", "Mileage updated.");
                        refresh();
                      }}
                      flash={actionFlash.mileage}
                    />
                    <AddVehicleRow
                      onSubmit={async (payload) => {
                        try {
                          const res = await fetch("/api/website/actions/add-vehicle", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify(payload),
                          });
                          const out = await res.json();
                          if (!res.ok || !out.success) {
                            throw new Error(out.message || "Could not add vehicle.");
                          }
                          flash("addveh", "Vehicle added.");
                          refresh();
                          return { success: true };
                        } catch (err) {
                          flash("addveh", err.message);
                          return { success: false, message: err.message };
                        }
                      }}
                      flash={actionFlash.addveh}
                    />
                  </section>

                  {/* Mileage history */}
                  {mileageRows.length > 0 ? (
                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Mileage history</h2>
                      </div>
                      <div style={mileageListStyle}>
                        {mileageRows.map((row) => (
                          <div key={row.history_id} style={mileageRowStyle}>
                            <span>{formatDate(row.recorded_at)}</span>
                            <span style={mileageBarStyle}>
                              <span style={mileageBarFillStyle(row.pct)} />
                            </span>
                            <span style={mileageValueStyle}>
                              {Number(row.mileage_at_service).toLocaleString()} mi
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {/* ───────── Jobs + VHC ───────── */}
                  <section id="jobs" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Jobs &amp; service history</h2>
                      <span style={cardCountStyle}>{jobs.length}</span>
                    </div>
                    {jobs.length === 0 ? (
                      <p style={emptyStyle}>No jobs on file yet.</p>
                    ) : (
                      <ul style={itemListStyle}>
                        {jobs.slice(0, 20).map((j) => {
                          const vhc = vhcByJob[j.id];
                          return (
                            <li key={j.id} style={itemRowStyle}>
                              <div>
                                <div style={itemTitleStyle}>
                                  {j.job_number || `Job #${j.id}`} · {j.type || "Service"}
                                </div>
                                <div style={itemMetaStyle}>
                                  {[j.vehicle_reg, j.vehicle_make_model, formatDate(j.created_at)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                                {vhc ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 6,
                                      marginTop: 6,
                                    }}
                                  >
                                    {vhc.red ? (
                                      <span style={vhcLightStyle("red")}>
                                        <span style={vhcDotStyle("red")} />
                                        {vhc.red}
                                      </span>
                                    ) : null}
                                    {vhc.amber ? (
                                      <span style={vhcLightStyle("amber")}>
                                        <span style={vhcDotStyle("amber")} />
                                        {vhc.amber}
                                      </span>
                                    ) : null}
                                    {vhc.green ? (
                                      <span style={vhcLightStyle("green")}>
                                        <span style={vhcDotStyle("green")} />
                                        {vhc.green}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <span style={badgeStyle}>{j.status || "—"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  {appointments.length > 0 ? (
                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Appointments</h2>
                        <span style={cardCountStyle}>{appointments.length}</span>
                      </div>
                      <ul style={itemListStyle}>
                        {appointments.map((a) => (
                          <li key={a.appointment_id} style={itemRowStyle}>
                            <div>
                              <div style={itemTitleStyle}>
                                {formatDateTime(a.scheduled_time)}
                              </div>
                              <div style={itemMetaStyle}>
                                {a.job_id ? `Job #${a.job_id} · ` : ""}
                                {a.status || "Booked"}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* ───────── Inspections (VHC media + items you declined) ───────── */}
                  {(data.vhcMedia?.length || 0) > 0 ||
                  (data.vhcDeclinations?.length || 0) > 0 ? (
                    <section id="inspections" style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Inspection photos &amp; video</h2>
                        <span style={cardCountStyle}>{data.vhcMedia?.length || 0}</span>
                      </div>
                      {(data.vhcMedia?.length || 0) === 0 ? (
                        <p style={emptyStyle}>
                          No media yet — uploaded inspection photos will appear here.
                        </p>
                      ) : (
                        <div style={mediaGridStyle}>
                          {(data.vhcMedia || []).slice(0, 16).map((m) => (
                            <a
                              key={m.id}
                              href={m.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={mediaThumbStyle}
                            >
                              {m.media_type === "video" ? (
                                <video
                                  src={m.public_url}
                                  muted
                                  preload="metadata"
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.public_url}
                                  alt={m.context_label || ""}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              )}
                              <span style={mediaTagStyle}>
                                {m.media_type === "video" ? "Video" : "Photo"}
                              </span>
                              {m.context_label ? (
                                <span style={mediaCaptionStyle}>{m.context_label}</span>
                              ) : null}
                            </a>
                          ))}
                        </div>
                      )}

                      {(data.vhcDeclinations?.length || 0) > 0 ? (
                        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                          <p style={settingsHintStyle}>
                            Items you previously declined — want to revisit?
                          </p>
                          <ul style={itemListStyle}>
                            {(data.vhcDeclinations || [])
                              .slice(0, 8)
                              .map((d, idx) => (
                                <li key={`${d.job_id}-${idx}`} style={itemRowStyle}>
                                  <div>
                                    <div style={itemTitleStyle}>
                                      {d.issue_title || d.section || "Item"}
                                    </div>
                                    {d.issue_description ? (
                                      <div style={itemMetaStyle}>{d.issue_description}</div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      callAction(
                                        "authorise_vhc_item",
                                        {
                                          job_id: d.job_id,
                                          issue_title: d.issue_title,
                                          issue_description: d.issue_description,
                                        },
                                        `reauth-${d.job_id}-${idx}`,
                                        "Sent — we'll be in touch to schedule.",
                                      )
                                    }
                                  >
                                    Authorise now
                                  </button>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {/* ───────── Money / Account / Invoices ───────── */}
                  <div id="invoices" style={gridSplitStyle}>
                    {accounts.length > 0
                      ? accounts.map((a) => (
                          <section key={a.account_id} style={cardStyle}>
                            <div style={cardHeaderStyle}>
                              <h2 style={cardTitleStyle}>
                                {a.account_type || "Account"} #{a.account_id}
                              </h2>
                              <span style={badgeStyle}>{a.status || "Active"}</span>
                            </div>
                            <div style={balanceHeroStyle}>
                              <span style={balanceFigureStyle}>
                                {formatCurrency(a.balance)}
                              </span>
                              <span style={balanceMetaStyle}>
                                Credit limit {formatCurrency(a.credit_limit)} ·{" "}
                                {a.credit_terms ?? 30}-day terms
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  callAction(
                                    "request_statement",
                                    { account_id: a.account_id },
                                    `stmt-${a.account_id}`,
                                    "Statement requested.",
                                  )
                                }
                              >
                                Request statement
                              </button>
                            </div>
                            {actionFlash[`stmt-${a.account_id}`] ? (
                              <p style={successStyle}>
                                {actionFlash[`stmt-${a.account_id}`]}
                              </p>
                            ) : null}
                          </section>
                        ))
                      : null}

                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Invoices</h2>
                        <span style={cardCountStyle}>{invoices.length}</span>
                      </div>
                      <div style={balanceHeroStyle}>
                        <span style={balanceFigureStyle}>
                          {formatCurrency(outstandingTotal)}
                        </span>
                        <span style={balanceMetaStyle}>
                          Outstanding across {outstandingInvoices.length} invoice
                          {outstandingInvoices.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {invoices.length === 0 ? (
                        <p style={emptyStyle}>
                          You don't have any invoices on your account yet.
                        </p>
                      ) : (
                        <ul style={itemListStyle}>
                          {invoices.slice(0, 12).map((i) => {
                            const total = i.grand_total ?? i.total;
                            const isPaid =
                              i.paid === true ||
                              (i.payment_status || "").toLowerCase() === "paid";
                            return (
                              <li key={i.invoice_id} style={itemRowStyle}>
                                <div>
                                  <div style={itemTitleStyle}>
                                    {i.invoice_number ||
                                      `Invoice ${i.invoice_id?.slice?.(0, 8) || ""}`}
                                    {i.job_number ? ` · ${i.job_number}` : ""}
                                  </div>
                                  <div style={itemMetaStyle}>
                                    {formatDate(i.created_at)} · {formatCurrency(total)}
                                    {i.due_date ? ` · Due ${formatDate(i.due_date)}` : ""}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <span style={isPaid ? badgePaidStyle : badgeOpenStyle}>
                                    {isPaid ? "Paid" : i.payment_status || "Open"}
                                  </span>
                                  {!isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        callAction(
                                          "request_payment_link",
                                          { invoice_id: i.invoice_id },
                                          `pay-${i.invoice_id}`,
                                          "Payment link requested.",
                                        )
                                      }
                                    >
                                      Pay
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      callAction(
                                        "request_invoice_pdf",
                                        { invoice_id: i.invoice_id },
                                        `pdf-${i.invoice_id}`,
                                        "PDF requested — we'll email it.",
                                      )
                                    }
                                  >
                                    PDF
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Saved payment methods</h2>
                        <span style={cardCountStyle}>{paymentMethods.length}</span>
                      </div>
                      {paymentMethods.length === 0 ? (
                        <p style={emptyStyle}>No saved cards on file.</p>
                      ) : (
                        <ul style={itemListStyle}>
                          {paymentMethods.map((p) => (
                            <li key={p.method_id} style={cardChipStyle}>
                              <span style={cardBrandStyle}>
                                {p.card_brand || "Card"} {p.is_default ? "· Default" : ""}
                              </span>
                              <span style={cardLineStyle}>
                                •••• {p.last4 || "----"} · expires{" "}
                                {String(p.expiry_month || "").padStart(2, "0")}/
                                {String(p.expiry_year || "").slice(-2)}
                              </span>
                              {p.nickname ? (
                                <span style={cardLineStyle}>{p.nickname}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>

                  {/* Account statement (transactions) */}
                  {(data.transactions?.length || 0) > 0 ? (
                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h2 style={cardTitleStyle}>Account statement</h2>
                        <span style={cardCountStyle}>{data.transactions.length}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          maxHeight: 360,
                          overflowY: "auto",
                        }}
                      >
                        {data.transactions.slice(0, 40).map((t) => {
                          const isCredit =
                            (t.type || "").toLowerCase() === "credit" ||
                            Number(t.amount) < 0;
                          return (
                            <div
                              key={t.transaction_id}
                              style={{ ...stmtRowStyle, background: "var(--website-elev-1)" }}
                            >
                              <span style={stmtMetaStyle}>
                                {formatDate(t.transaction_date)}
                              </span>
                              <span>
                                <div>{t.description || t.type}</div>
                                {t.job_number ? (
                                  <div style={stmtMetaStyle}>
                                    {t.job_number}
                                    {t.payment_method ? ` · ${t.payment_method}` : ""}
                                  </div>
                                ) : null}
                              </span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: isCredit ? "#86efac" : "#fca5a5",
                                }}
                              >
                                {isCredit ? "−" : ""}
                                {formatCurrency(Math.abs(Number(t.amount)))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {/* ───────── Messages ───────── */}
                  <section id="messages" style={cardWideStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Messages</h2>
                      <span style={cardCountStyle}>{messages.length}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        maxHeight: 400,
                        overflowY: "auto",
                        padding: 4,
                      }}
                    >
                      {messages.length === 0 ? (
                        <p style={emptyStyle}>
                          No messages yet — drop us a note below and we'll get back to you.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const isCustomer = m.activity_type === "message_customer";
                          const body =
                            m.activity_payload?.body ||
                            m.activity_payload?.summary ||
                            "(empty)";
                          return (
                            <div
                              key={m.event_id}
                              style={isCustomer ? bubbleCustomerStyle : bubbleStaffStyle}
                            >
                              {body}
                              <span style={bubbleMetaStyle}>
                                {isCustomer ? "You" : "Humphries & Parks"} ·{" "}
                                {formatDateTime(m.occurred_at)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <MessageComposer
                      onSend={(body) =>
                        callAction("send_message", { body }, "msg", "Message sent.")
                      }
                      flash={actionFlash.msg}
                    />
                  </section>

                  {/* ───────── Book a service ───────── */}
                  <section id="book" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Book a service</h2>
                    </div>
                    <BookServiceForm
                      vehicles={vehicles}
                      onSubmit={(payload) =>
                        callAction(
                          "book_service",
                          payload,
                          "book",
                          "Booking request sent — we'll confirm soon.",
                        )
                      }
                      flash={actionFlash.book}
                    />
                    {bookingRequests.length > 0 ? (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        <p style={settingsHintStyle}>Recent requests</p>
                        <ul style={itemListStyle}>
                          {bookingRequests.slice(0, 5).map((r) => (
                            <li key={r.request_id} style={itemRowStyle}>
                              <div>
                                <div style={itemTitleStyle}>
                                  {r.description || "Booking request"}
                                </div>
                                <div style={itemMetaStyle}>
                                  {formatDate(r.submitted_at)}
                                  {r.estimated_completion
                                    ? ` · ETA ${formatDate(r.estimated_completion)}`
                                    : ""}
                                </div>
                              </div>
                              <span style={badgeStyle}>{r.status || "Pending"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  {/* ───────── Our services ───────── */}
                  <section id="services" style={cardWideStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Our services</h2>
                    </div>
                    <p style={settingsHintStyle}>
                      Anything we do — pick what you need and we'll come back to you
                      with a quote or callback.
                    </p>
                    <ServiceQuoteRow
                      vehicles={vehicles}
                      onSubmit={(action, payload, label) =>
                        callAction(action, payload, "svcq", `${label} request sent.`)
                      }
                      flash={actionFlash.svcq}
                    />
                  </section>

                  {/* ───────── Sell your car ───────── */}
                  <section id="sell" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Sell your car</h2>
                    </div>
                    <p style={settingsHintStyle}>
                      Any age, any mileage, any make or model. Free valuation, no
                      obligation.
                    </p>
                    <SellCarForm
                      onSubmit={(payload) =>
                        callAction(
                          "request_valuation",
                          payload,
                          "sell",
                          "Valuation request sent.",
                        )
                      }
                      flash={actionFlash.sell}
                    />
                  </section>

                  {/* ───────── Showroom / callback ───────── */}
                  <section id="showroom" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Showroom</h2>
                    </div>
                    <p style={settingsHintStyle}>
                      See something you like? Tell us which car and we'll arrange a
                      callback or test drive.
                    </p>
                    <ShowroomCallbackForm
                      onSubmit={(payload) =>
                        callAction(
                          "request_vehicle_callback",
                          payload,
                          "show",
                          "Callback request sent.",
                        )
                      }
                      flash={actionFlash.show}
                    />
                    <div style={{ marginTop: 12 }}>
                      <Link href="/website#cars">Browse all cars</Link>
                    </div>
                  </section>

                  {/* ───────── Activity timeline ───────── */}
                  <section id="activity" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Activity</h2>
                      <span style={cardCountStyle}>{timeline.length}</span>
                    </div>
                    {timeline.length === 0 ? (
                      <p style={emptyStyle}>
                        Once you've booked in or had work done, your activity will
                        appear here.
                      </p>
                    ) : (
                      <div style={timelineStyle}>
                        {timeline.slice(0, 30).map((event) => (
                          <div key={event.event_id} style={timelineRowStyle}>
                            <span style={timelineWhenStyle}>
                              {formatDate(event.occurred_at)}
                            </span>
                            <span style={timelineWhatStyle}>
                              {humaniseActivity(event)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ───────── Expanded ownership-hub sections ─────────
                      Each card renders its own card surface using whatever
                      classes the component decides — they're left alone here
                      so the rest of /website/profile follows custglobal.css
                      without touching shared portal cards. */}
                  <OwnershipDashboardCard vehicles={vehicles} />
                  <LiveProgressTrackerCard jobs={jobs} customer={customer} />
                  <RepairApprovalTimelineCard jobs={jobs} jobStatusHistory={jobStatusHistory} />
                  <DigitalServiceHistoryCard jobs={jobs} jobHistory={jobHistory} invoices={invoices} vhcByJob={vhcByJob} />
                  <MotHistoryCard vehicles={vehicles} />
                  <RecallCheckerCard vehicles={vehicles} />
                  <VhcEnhancementsCard jobs={jobs} vhcByJob={vhcByJob} vhcDeclinations={vhcDeclinations} vhcMedia={vhcMedia} vhcShareLinks={data?.vhcShareLinks || []} />
                  <InvoicesPaymentsExtrasCard invoicePayments={invoicePayments} paymentPlans={paymentPlans} transactions={transactions} />
                  <DocumentsCentreCard invoices={invoices} vhcMedia={vhcMedia} />
                  <SalesShowroomCard />
                  <PartsPortalExtrasCard partsJobItems={partsJobItems} partsRequests={partsRequests} partsOrderCards={partsOrderCards} />
                  <SmartRepairCard bookingRequests={bookingRequests} />
                  <ValetDetailingCard bookingRequests={bookingRequests} />
                  <FamilyGarageCard customer={customer} vehicles={vehicles} />
                  <SelfServiceToolsCard vehicles={vehicles} vhcDeclinations={vhcDeclinations} />
                  <AiAssistantCard />

                  {/* ───────── Settings / security ───────── */}
                  <section id="settings" style={cardWideStyle}>
                    <div style={cardHeaderStyle}>
                      <h2 style={cardTitleStyle}>Account &amp; security</h2>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <ChangePasswordRow
                        onSuccess={() => flash("pw", "Password updated.")}
                        flash={actionFlash.pw}
                      />
                      <ChangeEmailRow
                        currentEmail={customer.email}
                        onSuccess={() => {
                          flash("email", "Email updated.");
                          refresh();
                        }}
                        flash={actionFlash.email}
                      />
                      <NotificationPrefsRow
                        initial={customer}
                        onSuccess={() => flash("prefs", "Preferences saved.")}
                        flash={actionFlash.prefs}
                      />
                      <ReferralRow
                        onSubmit={(payload) =>
                          callAction(
                            "refer_friend",
                            payload,
                            "ref",
                            "Thanks — we'll be in touch with your friend.",
                          )
                        }
                        flash={actionFlash.ref}
                      />
                      <DataActionsRow
                        onExport={() =>
                          callAction(
                            "request_data_export",
                            {},
                            "exp",
                            "Data export requested — we'll email it.",
                          )
                        }
                        onDelete={() =>
                          callAction(
                            "request_account_deletion",
                            {},
                            "del",
                            "Deletion request submitted.",
                          )
                        }
                        flashExp={actionFlash.exp}
                        flashDel={actionFlash.del}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={detailFieldStyle}>
      <span style={detailLabelStyle}>{label}</span>
      <span style={detailValueStyle}>{value || "—"}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text" }) {
  // type="email" is intentionally collapsed to "text" per custglobal.css —
  // the customer surface uses one capsule style for all text-shaped input.
  const inputType = type === "email" ? "text" : type;
  return (
    <div style={fieldStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MessageComposer({ onSend, flash }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="app-btn"
          disabled={sending || !body.trim()}
          onClick={async () => {
            setSending(true);
            await onSend(body.trim());
            setBody("");
            setSending(false);
          }}
        >
          Send
        </button>
      </div>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </>
  );
}

function BookServiceForm({ vehicles, onSubmit, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      style={formStyle}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_id: vehicleId || null,
          description: description.trim(),
          preferred_date: preferredDate || null,
        });
        setDescription("");
        setPreferredDate("");
        setSubmitting(false);
      }}
    >
      <div style={formRowStyle}>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Vehicle</label>
          <WebsiteNativeSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select..."
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Preferred date</label>
          <WebsiteNativeDateTimeInput
            type="date"
            value={preferredDate}
            onChange={setPreferredDate}
            placeholder="Pick a date"
          />
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={fieldLabelStyle}>What do you need?</label>
        <textarea
          placeholder="e.g. annual service + brake check"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !description.trim()}
      >
        {submitting ? "Sending…" : "Request booking"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </form>
  );
}

function ChangePasswordRow({ onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Password</div>
          <p style={settingsHintStyle}>
            Change the password you use to sign in here.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          style={formStyle}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: current,
                  newPassword: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not update password.");
              }
              setCurrent("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p style={errorStyle}>{error}</p> : null}
          <FieldInput
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
          />
          <FieldInput
            label="New password (min. 12 characters)"
            type="password"
            value={next}
            onChange={setNext}
          />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

function ChangeEmailRow({ currentEmail, onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Email</div>
          <p style={settingsHintStyle}>{currentEmail || "—"}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          style={formStyle}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: pw,
                  newEmail: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not change email.");
              }
              setPw("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p style={errorStyle}>{error}</p> : null}
          <FieldInput label="New email" value={next} onChange={setNext} />
          <FieldInput
            label="Current password"
            type="password"
            value={pw}
            onChange={setPw}
          />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update email"}
          </button>
        </form>
      ) : null}
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

function NotificationPrefsRow({ initial, onSuccess, flash }) {
  const [channel, setChannel] = useState(initial.contact_preference || "email");
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [serviceReminders, setServiceReminders] = useState(true);
  const [motReminders, setMotReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Notifications</div>
          <p style={settingsHintStyle}>How and when we contact you.</p>
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={fieldLabelStyle}>Preferred channel</label>
        <WebsiteNativeSelect
          value={channel}
          onChange={setChannel}
          options={[
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
            { value: "sms", label: "SMS" },
            { value: "post", label: "Post" },
          ]}
        />
      </div>
      <Toggle
        label="MOT reminders"
        checked={motReminders}
        onChange={setMotReminders}
      />
      <Toggle
        label="Service reminders"
        checked={serviceReminders}
        onChange={setServiceReminders}
      />
      <Toggle
        label="Marketing email (offers, news)"
        checked={marketingEmail}
        onChange={setMarketingEmail}
      />
      <Toggle label="Marketing SMS" checked={marketingSms} onChange={setMarketingSms} />
      <button
        type="button"
        className="app-btn"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const res = await fetch("/api/website/auth/notification-prefs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                contact_preference: channel,
                optIns: {
                  marketingEmail,
                  marketingSms,
                  serviceReminders,
                  motReminders,
                },
              }),
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  // Custom switch — custglobal.css explicitly avoids checkbox styling on
  // /website, so we render a role=switch element with onClick / onKeyDown
  // instead of a native <input type="checkbox">.
  const toggle = () => onChange(!checked);
  return (
    <div
      style={toggleRowStyle}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={toggleSwitchStyle(checked)}>
        <span style={toggleKnobStyle(checked)} />
      </span>
    </div>
  );
}

function DataActionsRow({ onExport, onDelete, flashExp, flashDel }) {
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Your data</div>
          <p style={settingsHintStyle}>
            Request a copy of everything we hold, or ask us to remove your
            account.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onExport}>
          Request data export
        </button>
        <button
          type="button"
          className="app-btn"
          onClick={() => {
            if (
              window.confirm(
                "Send an account deletion request? Our team will be in touch to confirm before anything is removed.",
              )
            ) {
              onDelete();
            }
          }}
        >
          Request account deletion
        </button>
      </div>
      {flashExp ? <p style={successStyle}>{flashExp}</p> : null}
      {flashDel ? <p style={successStyle}>{flashDel}</p> : null}
    </div>
  );
}

function ActiveJobTags({ job, bookingRequest, vhcSent }) {
  if (!job) return null;
  const tags = [];
  if ((job.service_mode || "").toLowerCase() === "mobile") {
    tags.push({
      key: "mobile",
      label: `Mobile visit${job.service_postcode ? ` · ${job.service_postcode}` : ""}`,
      tone: "accent",
    });
  }
  if (bookingRequest?.estimated_completion) {
    tags.push({
      key: "eta",
      label: `ETA ${formatDate(bookingRequest.estimated_completion)}`,
      tone: "default",
    });
  }
  if (bookingRequest?.loan_car_details) {
    tags.push({
      key: "loan",
      label: `Courtesy car · ${bookingRequest.loan_car_details}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_authorized_total) > 0) {
    tags.push({
      key: "vhc-auth",
      label: `Authorised ${formatCurrency(job.vhc_authorized_total)}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_declined_total) > 0) {
    tags.push({
      key: "vhc-dec",
      label: `Declined ${formatCurrency(job.vhc_declined_total)}`,
      tone: "default",
    });
  }
  if (vhcSent?.sent_at) {
    tags.push({
      key: "vhc-sent",
      label: `Report sent ${formatDate(vhcSent.sent_at)}`,
      tone: "default",
    });
  }
  if (tags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tags.map((t) => (
        <span
          key={t.key}
          style={
            t.tone === "accent"
              ? tagAccentStyle
              : t.tone === "ok"
              ? tagOkStyle
              : tagBaseStyle
          }
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function UpdateMileageRow({ vehicles, onSaved, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Update mileage</div>
          <p style={settingsHintStyle}>
            Help us flag the next service at the right time.
          </p>
        </div>
      </div>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <div style={formRowStyle}>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Vehicle</label>
          <WebsiteNativeSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select..."
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Current mileage</label>
          <input
            type="number"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 48250"
          />
        </div>
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={saving || !vehicleId || !mileage}
        onClick={async () => {
          setError("");
          setSaving(true);
          try {
            const res = await fetch("/api/website/actions/update-mileage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                vehicle_id: Number(vehicleId),
                mileage: Number(mileage),
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || "Could not update mileage.");
            }
            setMileage("");
            onSaved();
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save mileage"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

function AddVehicleRow({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const handleFetchVehicleData = async () => {
    if (!reg.trim()) {
      setLookupError("Please enter a registration number");
      return;
    }
    setIsLoadingVehicle(true);
    setLookupError("");
    try {
      const regUpper = reg.trim().toUpperCase();
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        let parsed;
        try { parsed = JSON.parse(responseText); } catch { parsed = null; }
        throw new Error(
          parsed?.message || parsed?.error || responseText ||
          `DVLA lookup failed with status ${response.status}`,
        );
      }
      let data = {};
      if (responseText) {
        try { data = JSON.parse(responseText); }
        catch { throw new Error("DVLA API returned malformed data"); }
      }
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle data found for that registration from DVLA");
      }
      const normalizedReg = (
        data.registrationNumber || data.registration || regUpper || ""
      ).toString().toUpperCase();
      const detectedMake = data.make || data.vehicleMake || "";
      const detectedModel = data.model || data.vehicleModel || "";
      const combined = `${detectedMake} ${detectedModel}`.trim();
      setReg(normalizedReg);
      setMakeModel(combined || detectedMake || "");
    } catch (err) {
      setLookupError(err.message || "Could not look up vehicle");
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Add a vehicle</div>
          <p style={settingsHintStyle}>
            We'll add this to your account straight away.
          </p>
        </div>
      </div>
      <div style={formRowStyle}>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Registration</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="e.g. AB12 CDE"
              style={{ flex: 1, textTransform: "uppercase" }}
            />
            <button
              type="button"
              className="app-btn"
              onClick={handleFetchVehicleData}
              disabled={isLoadingVehicle || !reg.trim()}
            >
              {isLoadingVehicle ? "Loading…" : "Search"}
            </button>
          </div>
        </div>
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      {lookupError ? <p style={errorStyle}>{lookupError}</p> : null}
      <div style={formRowStyle}>
        <FieldInput
          label="Mileage (optional)"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <FieldInput label="Notes (optional)" value={notes} onChange={setNotes} />
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={submitting || !reg.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            reg: reg.trim(),
            make_model: makeModel.trim(),
            mileage: mileage ? Number(mileage) : null,
            notes: notes.trim(),
          });
          setReg("");
          setMakeModel("");
          setMileage("");
          setNotes("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

function ServiceQuoteRow({ vehicles, onSubmit, flash }) {
  const [picked, setPicked] = useState(SERVICE_TYPES[0]);
  const [vehicleId, setVehicleId] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      <div style={serviceGridStyle}>
        {SERVICE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            style={serviceTileStyle(picked.id === t.id)}
            onClick={() => setPicked(t)}
          >
            <span style={serviceTileTitleStyle}>{t.title}</span>
            <span style={serviceTileHintStyle}>{t.hint}</span>
          </button>
        ))}
      </div>
      <form
        style={{ ...formStyle, marginTop: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!details.trim()) return;
          setSubmitting(true);
          await onSubmit(
            picked.action,
            {
              service_type: picked.id,
              vehicle_id: vehicleId || null,
              description: details.trim(),
              preferred_date: preferredDate || null,
            },
            picked.title,
          );
          setDetails("");
          setPreferredDate("");
          setSubmitting(false);
        }}
      >
        <div style={formRowStyle}>
          <div style={fieldStyle}>
            <label style={fieldLabelStyle}>Vehicle (optional)</label>
            <WebsiteNativeSelect
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Not specific to a vehicle"
              options={vehicles.map((v) => ({
                value: String(v.vehicle_id),
                label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
              }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={fieldLabelStyle}>Preferred date</label>
            <WebsiteNativeDateTimeInput
              type="date"
              value={preferredDate}
              onChange={setPreferredDate}
            />
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Tell us a bit more</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={`e.g. ${picked.hint.toLowerCase()}`}
          />
        </div>
        <button
          type="submit"
          className="app-btn"
          disabled={submitting || !details.trim()}
        >
          {submitting ? "Sending…" : `Request ${picked.title.toLowerCase()}`}
        </button>
        {flash ? <p style={successStyle}>{flash}</p> : null}
      </form>
    </>
  );
}

function SellCarForm({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("Excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      style={formStyle}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reg.trim()) return;
        setSubmitting(true);
        await onSubmit({
          reg: reg.trim(),
          make_model: makeModel.trim(),
          mileage: mileage ? Number(mileage) : null,
          condition,
          notes: notes.trim(),
        });
        setReg("");
        setMakeModel("");
        setMileage("");
        setNotes("");
        setSubmitting(false);
      }}
    >
      <div style={formRowStyle}>
        <FieldInput label="Registration" value={reg} onChange={setReg} />
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      <div style={formRowStyle}>
        <FieldInput
          label="Mileage"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Condition</label>
          <WebsiteNativeSelect
            value={condition}
            onChange={setCondition}
            options={[
              { value: "Excellent", label: "Excellent" },
              { value: "Good", label: "Good" },
              { value: "Average", label: "Average" },
              { value: "Below average", label: "Below average" },
            ]}
          />
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={fieldLabelStyle}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Service history, modifications, anything else we should know."
        />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !reg.trim()}
      >
        {submitting ? "Sending…" : "Get free valuation"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </form>
  );
}

function ShowroomCallbackForm({ onSubmit, flash }) {
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      style={formStyle}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!interest.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_interest: interest.trim(),
          notes: notes.trim(),
          callback_date: callbackDate || null,
        });
        setInterest("");
        setNotes("");
        setCallbackDate("");
        setSubmitting(false);
      }}
    >
      <FieldInput label="Which vehicle?" value={interest} onChange={setInterest} />
      <div style={formRowStyle}>
        <div style={fieldStyle}>
          <label style={fieldLabelStyle}>Preferred callback</label>
          <WebsiteNativeDateTimeInput
            type="date"
            value={callbackDate}
            onChange={setCallbackDate}
          />
        </div>
        <FieldInput label="Notes" value={notes} onChange={setNotes} />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !interest.trim()}
      >
        {submitting ? "Sending…" : "Request callback"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </form>
  );
}

function ReferralRow({ onSubmit, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div style={settingsRowStyle}>
      <div style={settingsRowHeaderStyle}>
        <div>
          <div style={settingsTitleStyle}>Refer a friend</div>
          <p style={settingsHintStyle}>
            Send us a friend who needs us — we'll take it from there.
          </p>
        </div>
      </div>
      <div style={formRowStyle}>
        <FieldInput label="Their name" value={name} onChange={setName} />
        <FieldInput label="Their email" value={email} onChange={setEmail} />
      </div>
      <FieldInput label="Their phone (optional)" value={phone} onChange={setPhone} />
      <button
        type="button"
        className="app-btn"
        disabled={submitting || !name.trim() || !email.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            referred_name: name.trim(),
            referred_email: email.trim(),
            referred_phone: phone.trim(),
          });
          setName("");
          setEmail("");
          setPhone("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Sending…" : "Send referral"}
      </button>
      {flash ? <p style={successStyle}>{flash}</p> : null}
    </div>
  );
}

CustomerProfilePage.getLayout = (page) => page;
