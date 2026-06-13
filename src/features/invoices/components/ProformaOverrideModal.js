// file location: src/features/invoices/components/ProformaOverrideModal.js
// Reusable proforma row-override editor, shared by InvoiceDetail (document
// layout) and InvoiceWorkspace (job-card layout). Exposes a hook that owns the
// editor state + save flow and returns an `openEditor(request)` function plus
// the rendered modal node.
//
// The save flow optimistically patches the in-memory payload via `onDataPatch`
// (recomputing header totals) and then refreshes from the server via
// `onDataRefresh`, matching the original InvoiceDetail behaviour.
import React, { useCallback, useState } from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";

export const BILLING_OPTIONS = [
  "Customer",
  "Warranty",
  "Sales Goodwill",
  "Service Goodwill",
  "Internal",
  "Insurance",
  "Lease Company",
  "Staff",
];

export const toFixedInput = (value, fallback = "0.00") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toFixed(2);
};

export function useProformaOverrideEditor({ jobIdForOverride, onDataPatch, onDataRefresh }) {
  const [editingRequest, setEditingRequest] = useState(null);
  const [overrideForm, setOverrideForm] = useState(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [billingDropdownSeed, setBillingDropdownSeed] = useState(0);

  const openEditor = useCallback((request) => {
    setBillingDropdownSeed((prev) => prev + 1);
    const currentPartsNet = (request?.totals?.request_total_net || 0) - (request?.labour?.net || 0);
    const override = request?.proforma_override || {};
    setEditingRequest(request);
    const summarySeed = String(
      override?.summary_override ?? request?.summary ?? request?.job_type ?? "Customer"
    ).trim();
    const normalizedSummary = BILLING_OPTIONS.includes(summarySeed) ? summarySeed : "Customer";
    setOverrideForm({
      titleOverride: override.title_override ?? request?.title ?? "",
      summaryOverride: normalizedSummary,
      labourHoursOverride:
        override.labour_hours_override !== null && override.labour_hours_override !== undefined
          ? toFixedInput(override.labour_hours_override)
          : toFixedInput(request?.labour?.hours ?? 0),
      partsTotalOverride:
        override.parts_total_override !== null && override.parts_total_override !== undefined
          ? toFixedInput(override.parts_total_override)
          : toFixedInput(currentPartsNet ?? 0),
      labourTotalOverride:
        override.labour_total_override !== null && override.labour_total_override !== undefined
          ? toFixedInput(override.labour_total_override)
          : toFixedInput(request?.labour?.net ?? 0),
      taxTotalOverride:
        override.tax_total_override !== null && override.tax_total_override !== undefined
          ? toFixedInput(override.tax_total_override)
          : toFixedInput(request?.totals?.request_total_vat ?? 0),
      totalOverride:
        override.total_override !== null && override.total_override !== undefined
          ? toFixedInput(override.total_override)
          : toFixedInput(request?.totals?.request_total_gross ?? 0),
    });
  }, []);

  const closeEditor = useCallback(() => {
    if (overrideSaving) return;
    setEditingRequest(null);
    setOverrideForm(null);
  }, [overrideSaving]);

  const handleSave = useCallback(async () => {
    if (!editingRequest || !overrideForm || !jobIdForOverride) return;
    try {
      setOverrideSaving(true);
      const response = await fetch("/api/invoices/proforma-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobId: jobIdForOverride,
          requestKey:
            editingRequest?.proforma_key ||
            `${editingRequest?.request_kind || "request"}:id:${editingRequest?.request_id ?? editingRequest?.request_number}`,
          requestId: editingRequest?.request_id ?? null,
          requestKind: editingRequest?.request_kind || "request",
          requestNumber: editingRequest?.request_number || null,
          titleOverride: overrideForm.titleOverride,
          summaryOverride: overrideForm.summaryOverride,
          labourHoursOverride: overrideForm.labourHoursOverride,
          partsTotalOverride: overrideForm.partsTotalOverride,
          labourTotalOverride: overrideForm.labourTotalOverride,
          taxTotalOverride: overrideForm.taxTotalOverride,
          totalOverride: overrideForm.totalOverride,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to save override");
      }
      if (typeof onDataPatch === "function") {
        onDataPatch((prev) => {
          const prevRequests = Array.isArray(prev?.requests) ? prev.requests : [];
          const nextRequests = prevRequests.map((row) => {
            const sameKey = (row?.proforma_key || "") === (editingRequest?.proforma_key || "");
            const sameLegacy =
              !sameKey &&
              String(row?.request_kind || "") === String(editingRequest?.request_kind || "") &&
              String(row?.request_id ?? "") === String(editingRequest?.request_id ?? "") &&
              Number(row?.request_number || 0) === Number(editingRequest?.request_number || 0);
            if (!sameKey && !sameLegacy) return row;

            const labourNet = Number(overrideForm.labourTotalOverride || 0) || 0;
            const partsNet = Number(overrideForm.partsTotalOverride || 0) || 0;
            const taxTotal = Number(overrideForm.taxTotalOverride || 0) || 0;
            const total = Number(overrideForm.totalOverride || 0) || 0;
            const labourHours = Number(overrideForm.labourHoursOverride || 0) || 0;

            return {
              ...row,
              title: overrideForm.titleOverride || row.title,
              summary: overrideForm.summaryOverride || row.summary,
              labour: {
                ...(row.labour || {}),
                hours: labourHours,
                net: labourNet,
              },
              totals: {
                ...(row.totals || {}),
                request_total_net: labourNet + partsNet,
                request_total_vat: taxTotal,
                request_total_gross: total,
              },
              proforma_override: {
                title_override: overrideForm.titleOverride || "",
                summary_override: overrideForm.summaryOverride || "",
                labour_hours_override: labourHours,
                parts_total_override: partsNet,
                labour_total_override: labourNet,
                tax_total_override: taxTotal,
                total_override: total,
              },
            };
          });

          const totals = nextRequests.reduce(
            (acc, row) => ({
              service_total: acc.service_total + Number(row?.totals?.request_total_net || 0),
              vat_total: acc.vat_total + Number(row?.totals?.request_total_vat || 0),
              invoice_total: acc.invoice_total + Number(row?.totals?.request_total_gross || 0),
            }),
            { service_total: 0, vat_total: 0, invoice_total: 0 }
          );

          return {
            ...prev,
            requests: nextRequests,
            invoice: {
              ...(prev.invoice || {}),
              totals,
            },
          };
        });
      }
      setEditingRequest(null);
      setOverrideForm(null);
      if (typeof onDataRefresh === "function") {
        await onDataRefresh();
      }
    } catch (error) {
      console.error("Failed to save proforma override", error);
      alert(error?.message || "Failed to save proforma override");
    } finally {
      setOverrideSaving(false);
    }
  }, [editingRequest, overrideForm, jobIdForOverride, onDataPatch, onDataRefresh]);

  const modal =
    editingRequest && overrideForm ? (
      <ProformaOverrideModal
        editingRequest={editingRequest}
        overrideForm={overrideForm}
        setOverrideForm={setOverrideForm}
        overrideSaving={overrideSaving}
        billingDropdownSeed={billingDropdownSeed}
        onClose={closeEditor}
        onSave={handleSave}
      />
    ) : null;

  return { openEditor, modal };
}

export default function ProformaOverrideModal({
  editingRequest,
  overrideForm,
  setOverrideForm,
  overrideSaving,
  billingDropdownSeed,
  onClose,
  onSave,
}) {
  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1200,
          padding: "16px",
        }}
      >
        <div
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            width: "min(760px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--control-radius)",
            border: "none",
            padding: "18px",
            display: "grid",
            gap: "12px",
          }}
        >
          <h3 style={{ margin: 0 }}>
            {editingRequest.request_label || `Request ${editingRequest.request_number}`}
          </h3>
          <div style={{ display: "grid", gap: "8px" }}>
            <label style={{ display: "grid", gap: "4px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Description Override</span>
              <textarea
                rows={2}
                value={overrideForm.titleOverride}
                onChange={(event) =>
                  setOverrideForm((prev) => ({ ...prev, titleOverride: event.target.value }))
                }
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Billing To</span>
              <DropdownField
                key={`billing-${editingRequest?.proforma_key || editingRequest?.request_number || "row"}-${billingDropdownSeed}`}
                options={BILLING_OPTIONS.map((option) => ({ value: option, label: option }))}
                value={overrideForm.summaryOverride}
                onValueChange={(value) =>
                  setOverrideForm((prev) => ({ ...prev, summaryOverride: String(value || "Customer") }))
                }
                placeholder="Select billing type"
                size="sm"
                usePortal={false}
                menuStyle={{ maxHeight: "132px", overflowY: "auto" }}
              />
            </label>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {[
              ["Labour Hours", "labourHoursOverride"],
              ["Parts Total (Net)", "partsTotalOverride"],
              ["Labour Total (Net)", "labourTotalOverride"],
              ["Tax Total", "taxTotalOverride"],
              ["Total", "totalOverride"],
            ].map(([label, key]) => (
              <label key={key} style={{ display: "grid", gap: "4px" }}>
                <span style={{ fontSize: "0.76rem", color: "var(--text-1)" }}>{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={overrideForm[key]}
                  onChange={(event) =>
                    setOverrideForm((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  onBlur={(event) =>
                    setOverrideForm((prev) => ({
                      ...prev,
                      [key]: toFixedInput(event.target.value, "0.00"),
                    }))
                  }
                  style={{
                    padding: "6px 8px",
                    fontSize: "0.85rem",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    appearance: "textfield",
                    MozAppearance: "textfield",
                  }}
                />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "var(--surface)", color: "var(--text-1)" }}
            >
              Cancel
            </button>
            <button type="button" onClick={onSave} disabled={overrideSaving}>
              {overrideSaving ? "Saving..." : "Save Proforma Override"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
