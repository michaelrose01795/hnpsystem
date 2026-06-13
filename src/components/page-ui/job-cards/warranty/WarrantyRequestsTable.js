// file location: src/components/page-ui/job-cards/warranty/WarrantyRequestsTable.js
// "Warranty Requests / Authorisation" section: a table of warranty_requests rows
// (date, type, status, amount, requested by, actions) plus an inline add-request
// form. Section is a LayerTheme; the add-request form flips to LayerSurface.
import React, { useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { DropdownField } from "@/components/ui/dropdownAPI";
import {
  formatCurrency,
  DASH,
} from "@/components/page-ui/job-cards/service-history/historyFormat";

const TYPE_OPTIONS = [
  { value: "authorisation", label: "Authorisation" },
  { value: "parts", label: "Parts" },
  { value: "labour", label: "Labour" },
  { value: "goodwill", label: "Goodwill" },
];

const STATUS_TONE = {
  pending: "app-badge--warning",
  approved: "app-badge--success",
  rejected: "app-badge--danger",
};

const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const formatDate = (value) => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const requesterName = (request) => {
  const user = request?.requestedByUser;
  if (!user) return DASH;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || DASH;
};

export default function WarrantyRequestsTable({
  requests = [],
  canEdit = false,
  busy = false,
  onAddRequest = () => {},
  onUpdateRequest = () => {},
  style,
}) {
  const [adding, setAdding] = useState(false);
  const [draftType, setDraftType] = useState("authorisation");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const resetDraft = () => {
    setDraftType("authorisation");
    setDraftAmount("");
    setDraftNote("");
    setAdding(false);
  };

  const handleAdd = () => {
    onAddRequest({
      requestType: draftType,
      amount: Number(draftAmount) || 0,
      note: draftNote,
    });
    resetDraft();
  };

  const sorted = [...requests].sort(
    (a, b) => new Date(b.request_date || 0) - new Date(a.request_date || 0)
  );

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-requests"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Requests / Authorisation
        </h3>
        {canEdit && !adding && (
          <button type="button" className="app-btn app-btn--primary" onClick={() => setAdding(true)}>
            Add Request
          </button>
        )}
      </div>

      {canEdit && adding && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-requests-form"
          parentKey="jobcard-tab-warranty-requests"
          gap="12px"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label>Type</label>
              <DropdownField
                value={draftType}
                onValueChange={setDraftType}
                options={TYPE_OPTIONS}
                disabled={busy}
              />
            </div>
            <div>
              <label>Amount (inc VAT)</label>
              <input
                className="app-input"
                type="number"
                min="0"
                step="0.01"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                placeholder="0.00"
                disabled={busy}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Note (optional)</label>
              <input
                className="app-input"
                type="text"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Reason / reference"
                disabled={busy}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleAdd}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save Request"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={resetDraft}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </LayerSurface>
      )}

      {sorted.length === 0 ? (
        <div className="app-status-message app-status-message--info">
          No warranty requests have been raised yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="app-data-table app-data-table--rounded">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Requested By</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((request) => {
                const status = request.status || "pending";
                return (
                  <tr key={request.id}>
                    <td>{formatDate(request.request_date)}</td>
                    <td>{TYPE_LABEL[request.request_type] || request.request_type || DASH}</td>
                    <td>
                      <span className={`app-badge ${STATUS_TONE[status] || "app-badge--neutral"}`}>
                        {status}
                      </span>
                    </td>
                    <td>{formatCurrency(Number(request.amount) || 0)}</td>
                    <td>{requesterName(request)}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {status !== "approved" && (
                            <button
                              type="button"
                              className="app-table-action-btn app-table-action-btn--primary"
                              onClick={() => onUpdateRequest(request.id, { status: "approved" })}
                              disabled={busy}
                            >
                              Approve
                            </button>
                          )}
                          {status !== "rejected" && (
                            <button
                              type="button"
                              className="app-table-action-btn app-table-action-btn--danger"
                              onClick={() => onUpdateRequest(request.id, { status: "rejected" })}
                              disabled={busy}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </LayerTheme>
  );
}
