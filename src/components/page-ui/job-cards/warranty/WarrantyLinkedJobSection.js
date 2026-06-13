// file location: src/components/page-ui/job-cards/warranty/WarrantyLinkedJobSection.js
// "Linked Warranty Job" section: the warranty job's work-line descriptions plus a
// button that navigates to that job card. Descriptions arrive on
// jobData.warrantyLinkedRequests (loaded server-side). Section is a LayerTheme; the
// description list flips to LayerSurface (depth 2).
import React from "react";
import { useRouter } from "next/router";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";

export default function WarrantyLinkedJobSection({ jobData, linkedJob, style }) {
  const router = useRouter();
  const requests = jobData?.warrantyLinkedRequests || [];

  const handleView = () => {
    if (!linkedJob?.jobNumber) return;
    router.push(`/job-cards/${linkedJob.jobNumber}`);
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-linked-job"
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
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
            Linked Warranty Job
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
            #{linkedJob?.jobNumber || "—"}
            {linkedJob?.status ? ` · ${linkedJob.status}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="app-btn app-btn--primary"
          onClick={handleView}
          disabled={!linkedJob?.jobNumber}
        >
          View Warranty Job
        </button>
      </div>

      <LayerSurface
        sectionKey="jobcard-tab-warranty-linked-job-lines"
        parentKey="jobcard-tab-warranty-linked-job"
        gap="8px"
      >
        {requests.length === 0 ? (
          <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
            No work lines recorded on the linked warranty job yet.
          </span>
        ) : (
          requests.map((request, index) => (
            <div
              key={request.request_id || index}
              style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--accentText)",
                  minWidth: "20px",
                }}
              >
                {index + 1}.
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-1)", flex: 1, minWidth: 0 }}>
                {request.description || "Untitled work line"}
                {request.hours ? (
                  <span style={{ opacity: 0.6 }}> · {request.hours}h</span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </LayerSurface>
    </LayerTheme>
  );
}
