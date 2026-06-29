// file location: src/components/reporting/ReportDrilldownTable.js
//
// Shows the contributing records behind a KPI (from /api/reports/drilldown) and
// offers a CSV export (the audited /api/reports/export endpoint). It renders the
// rows the engine returned as-is; column set is inferred from the data so any
// KPI's drill-down works without bespoke wiring.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useDrilldown, buildExportUrl } from "@/hooks/reporting/useReporting";
import { reportDevKey } from "./reportDevOverlay";

const PRETTY = (k) =>
  String(k)
    .replace(/^report_summary$/, "Summary")
    .replace(/^report_context$/, "Context")
    .replace(/_/g, " ")
    .replace(/\bgbp\b/i, "GBP")
    .replace(/^\w/, (c) => c.toUpperCase());

const cell = (v) => {
  if (v == null) return "-";
  if (typeof v === "number") return v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const ID_COLUMN_KEYS = new Set([
  "id",
  "job_id",
  "user_id",
  "actor_user_id",
  "created_by",
  "booked_by",
  "assigned_to",
  "checked_in_by",
  "wash_completed_by",
  "redirected_from_mobile_by",
  "customer_id",
  "vehicle_id",
  "part_id",
  "delivery_id",
  "delivery_item_id",
  "invoice_id",
  "payment_id",
  "appointment_id",
  "vhc_id",
  "entity_id",
]);

const DATE_KEY_HINTS = ["_at", "_date", "date", "time", "due", "scheduled"];

const isInternalIdColumn = (key) => {
  const k = String(key || "").toLowerCase();
  return ID_COLUMN_KEYS.has(k) || k.endsWith("_id") || k.endsWith("_uuid") || k.endsWith("_auth_uuid");
};

const isDateLikeKey = (key) => DATE_KEY_HINTS.some((hint) => String(key || "").toLowerCase().includes(hint));

const formatDateTime = (value, key) => {
  if (typeof value !== "string") return null;
  const full = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (full) return `${full[3]}/${full[2]}/${full[1].slice(2)} - ${full[4]}:${full[5]}`;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1].slice(2)}`;
  if (!isDateLikeKey(key)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} - ${time}`;
};

const firstPresent = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
};

const nestedFirstPresent = (row, paths) => {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => acc?.[key], row);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
};

const joinParts = (parts) => parts.filter((part) => part !== null && part !== undefined && part !== "").join(" - ");

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

const dateForSummary = (row) =>
  formatDateTime(
    firstPresent(row, [
      "completed_at",
      "created_at",
      "updated_at",
      "checked_in_at",
      "invoice_date",
      "payment_date",
      "attempted_at",
      "occurred_at",
      "scheduled_time",
      "due_date",
      "last_seen",
    ]),
    "date"
  );

const deriveReportSummary = (row, label, entityType) => {
  const invoice = firstPresent(row, ["invoice_number"]) || nestedFirstPresent(row, ["invoices.invoice_number"]);
  if (invoice) {
    return joinParts([
      `Invoice ${invoice}`,
      firstPresent(row, ["job_number"]) || nestedFirstPresent(row, ["invoices.job_number"]),
      money(firstPresent(row, ["grand_total", "invoice_total", "total"])),
    ]);
  }

  const part = firstPresent(row, ["part_number", "part_number_snapshot", "name", "part_name_snapshot", "description", "issue_title"]);
  if (part && String(entityType || "").includes("part")) {
    return joinParts([
      part,
      firstPresent(row, ["status", "movement_type"]),
      firstPresent(row, ["quantity_requested", "quantity_ordered", "quantity_fitted", "quantity", "qty_in_stock"]),
    ]);
  }

  const vehicle = joinParts([
    firstPresent(row, ["vehicle_reg", "reg_number", "registration"]),
    firstPresent(row, ["vehicle_make_model", "make_model", "make", "model"]),
  ]);
  const job = firstPresent(row, ["job_number"]) || (row?.job_id ? `Job ${row.job_id}` : null);
  if (job || vehicle) {
    return joinParts([job, vehicle, firstPresent(row, ["customer", "customer_name"])]);
  }

  const actor = firstPresent(row, ["email", "actor_role", "user_id", "actor_user_id"]);
  if (actor) {
    return joinParts([actor, firstPresent(row, ["action", "outcome", "access", "defect", "failure_reason"])]);
  }

  const account = firstPresent(row, ["account_number", "account_id", "billing_name"]);
  if (account) {
    return joinParts([account, firstPresent(row, ["status", "payment_status"]), money(firstPresent(row, ["balance", "credit_limit"]))]);
  }

  return joinParts([label, firstPresent(row, ["rank", "monitor", "category", "status"]), dateForSummary(row)]);
};

const deriveReportContext = (row) => {
  const amount = money(firstPresent(row, ["grand_total", "invoice_total", "labour_total", "parts_total", "amount", "balance", "unit_cost", "unit_price", "total"]));
  const status = joinParts([
    firstPresent(row, ["status", "payment_status", "completion_status", "outcome", "wash_state", "mobile_outcome"]),
    firstPresent(row, ["severity", "category", "defect"]),
  ]);
  const timing = dateForSummary(row);
  const quantity = firstPresent(row, ["quantity_requested", "quantity_ordered", "quantity_fitted", "quantity", "qty_in_stock", "jobs", "tests", "audited_actions"]);
  return joinParts([status, amount, quantity != null ? `Qty ${quantity}` : null, timing]);
};

const displayCell = (value, key) => {
  if (value == null) return cell(value);
  const formattedDate = formatDateTime(value, key);
  if (formattedDate) return formattedDate;
  return cell(value);
};

function DrilldownTableSkeleton() {
  const columns = ["Summary", "Context", "Status", "Date", "Value"];
  return (
    <div className="app-table-shell-scroll" data-report-table-pan style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
      <SkeletonKeyframes />
      <table className="app-data-table app-table-shell app-table-shell--with-headings" style={{ width: "100%" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td key={column} style={{ whiteSpace: "nowrap" }}>
                  <SkeletonBlock
                    width={columnIndex === 0 ? "180px" : columnIndex === 1 ? "150px" : "92px"}
                    height="14px"
                    borderRadius="999px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportDrilldownTable({ kpiId, label, filter, onClose, parentKey }) {
  const { loading, error, rows, count, entityType, warnings } = useDrilldown(kpiId, filter, { enabled: Boolean(kpiId) });
  const [query, setQuery] = useState("");

  const displayRows = useMemo(
    () =>
      rows.map((row) => ({
        report_summary: deriveReportSummary(row || {}, label || kpiId, entityType),
        report_context: deriveReportContext(row || {}),
        ...(row || {}),
      })),
    [rows, label, kpiId, entityType]
  );

  const columns = useMemo(() => {
    const seen = [];
    displayRows.slice(0, 50).forEach((r) =>
      Object.keys(r || {}).forEach((k) => !isInternalIdColumn(k) && !seen.includes(k) && seen.push(k))
    );
    return seen;
  }, [displayRows]);

  // Client-side filter across every column of the already-fetched rows. The
  // engine still owns the record set; this only narrows what is shown.
  const q = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!q) return displayRows;
    return displayRows.filter((r) => columns.some((c) => displayCell(r?.[c], c).toLowerCase().includes(q)));
  }, [displayRows, columns, q]);

  const total = count ?? rows.length;
  const countLabel = q
    ? `${filteredRows.length} of ${total} record${total === 1 ? "" : "s"}${entityType ? ` - ${entityType}` : ""}`
    : `${total} record${total === 1 ? "" : "s"}${entityType ? ` - ${entityType}` : ""}`;
  const noData = !loading && rows.length === 0 && !error;
  const noMatch = !loading && rows.length > 0 && filteredRows.length === 0;

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding="16px"
      gap="12px"
      sectionKey={reportDevKey("report-drilldown", kpiId || label)}
      parentKey={parentKey}
      sectionType="data-table"
      data-dev-text-preview={`${label || kpiId} drill-down table`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "nowrap" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--accentText)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {label || kpiId} - contributing records
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--surfaceTextMuted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {loading ? <SkeletonBlock width="140px" height="12px" borderRadius="999px" /> : countLabel}
          </div>
        </div>

        <SearchBar
          type="search"
          ariaLabel="Filter records"
          placeholder="Filter records..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          style={{ flex: "0 1 220px", minWidth: 120 }}
        />

        <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
          <a
            className="app-btn app-btn--primary app-btn--sm"
            href={buildExportUrl(kpiId, filter)}
            style={{ textDecoration: "none" }}
          >
            Export CSV
          </a>
          {typeof onClose === "function" && (
            <button
              type="button"
              className="app-btn app-btn--primary app-btn--icon app-btn--sm"
              onClick={onClose}
              aria-label="Close drill-down"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.82rem" }}>{error}</div>}
      {Array.isArray(warnings) && warnings.length > 0 && (
        <div style={{ color: "var(--warning-base)", fontSize: "0.76rem" }}>{warnings.join("; ")}</div>
      )}

      {loading ? (
        <DrilldownTableSkeleton />
      ) : noData ? (
        <div style={{ color: "var(--surfaceTextMuted)", fontSize: "0.85rem", padding: "12px 0" }}>
          No records for the selected period.
        </div>
      ) : noMatch ? (
        <div style={{ color: "var(--surfaceTextMuted)", fontSize: "0.85rem", padding: "12px 0" }}>
          No records match "{query}".
        </div>
      ) : (
        <div
          className="app-table-shell-scroll"
          data-report-table-pan
          data-dev-section-key={reportDevKey("report-drilldown-scroll", kpiId || label)}
          data-dev-section-type="section-shell"
          data-dev-section-parent={reportDevKey("report-drilldown", kpiId || label)}
          data-dev-background-token="transparent"
          data-dev-text-preview={`${label || kpiId} drill-down scroll area`}
          style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}
        >
          <table className="app-data-table app-table-shell app-table-shell--with-headings" style={{ width: "100%" }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                    {PRETTY(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={r.id ?? r.vhc_id ?? r.user_id ?? i}>
                  {columns.map((c) => (
                    <td key={c} style={{ whiteSpace: "nowrap" }}>
                      {displayCell(r[c], c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LayerSurface>
  );
}
