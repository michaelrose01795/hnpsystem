// file location: src/features/customerPortal/components/sections/DigitalServiceHistoryCard.js
// Completed visits, mileage snapshots, invoices and VHC counts from the live
// customer portal bundle.
import React from "react";
import SectionShell from "./SectionShell";
import { ItemList, ItemRow, Badge, GhostBtn, Empty } from "./_websiteParts";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isCompleted = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return ["delivered", "closed", "completed", "collected", "invoiced"].some((token) =>
    status.includes(token),
  ) || Boolean(job.completed_at);
};

export default function DigitalServiceHistoryCard({
  jobs = [],
  jobHistory = [],
  invoices = [],
  vhcByJob = {},
}) {
  const invoiceByJobNumber = new Map(
    invoices.map((invoice) => [String(invoice.job_number || ""), invoice]),
  );

  const history = jobHistory.length
    ? jobHistory.map((row) => {
        const invoice = invoiceByJobNumber.get(String(row.job_number || ""));
        const vhc = vhcByJob?.[row.job_id] || {};
        return {
          id: row.history_id || row.job_id || row.job_number,
          date: row.recorded_at,
          mileage: row.mileage_at_service,
          type: row.status_snapshot || row.vehicle_make_model || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "-",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: row.vehicle_reg ? `${row.vehicle_reg} - ${row.vehicle_make_model || "vehicle"}` : null,
        };
      })
    : jobs.filter(isCompleted).map((job) => {
        const invoice = invoiceByJobNumber.get(String(job.job_number || ""));
        const vhc = vhcByJob?.[job.id] || {};
        return {
          id: job.id || job.job_number,
          date: job.completed_at || job.updated_at || job.created_at,
          mileage: null,
          type: job.description || job.type || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "-",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: job.vehicle_reg ? `${job.vehicle_reg} - ${job.vehicle_make_model || "vehicle"}` : null,
        };
      });

  return (
    <SectionShell
      id="history"
      eyebrow="Service log"
      title="Digital service history"
      count={`${history.length} visit${history.length === 1 ? "" : "s"}`}
      action={<GhostBtn href="#messages">Request PDF</GhostBtn>}
    >
      {history.length === 0 ? (
        <Empty>No completed service history has been recorded for this account yet.</Empty>
      ) : (
        <ItemList>
          {history.map((visit) => (
            <ItemRow
              key={visit.id}
              title={visit.type}
              meta={`${formatDate(visit.date)} - ${visit.mileage ? `${visit.mileage} miles` : "mileage not recorded"} - ${visit.invoice}`}
              right={
                <div style={{ display: "flex", gap: 6 }}>
                  {visit.red > 0 ? <Badge tone="open">{visit.red} red</Badge> : null}
                  {visit.amber > 0 ? <Badge>{visit.amber} amber</Badge> : null}
                  {visit.red === 0 && visit.amber === 0 ? <Badge tone="ok">No red/amber</Badge> : null}
                </div>
              }
            >
              {visit.note ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--txt-soft)" }}>{visit.note}</p>
              ) : null}
            </ItemRow>
          ))}
        </ItemList>
      )}
    </SectionShell>
  );
}
