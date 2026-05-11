// file location: src/features/customerPortal/components/sections/DigitalServiceHistoryCard.js
// Completed visits, with mileage, invoice, advisory counts and tech notes.
// Uses completed jobs from the portal API where present; mocks otherwise.
import React from "react";
import SectionShell from "./SectionShell";
import { ItemList, ItemRow, Badge, GhostBtn } from "./_websiteParts";

const MOCK = [
  { id: "h1", date: "14 Mar 2026", mileage: "42,180", type: "Annual service + MOT", invoice: "INV-10421", red: 0, amber: 2, note: "Brake pads ~40%. Rear tyres advised within 12 months." },
  { id: "h2", date: "06 Aug 2025", mileage: "36,210", type: "Interim service", invoice: "INV-9712", red: 0, amber: 1, note: "Wipers replaced. Air-con regas recommended next visit." },
  { id: "h3", date: "21 Jan 2025", mileage: "30,402", type: "Cambelt + waterpump", invoice: "INV-9123", red: 0, amber: 0, note: "Full timing kit replaced. Coolant flushed." },
];

export default function DigitalServiceHistoryCard({ jobs = [] }) {
  const completed = (jobs || []).filter((j) =>
    ["delivered", "closed", "completed"].includes(String(j.status || "").toLowerCase())
  );
  const history = completed.length
    ? completed.map((j) => ({
        id: j.id,
        date: j.createdAt || "—",
        mileage: j.mileage || "—",
        type: j.concern || "Workshop visit",
        invoice: j.invoiceNumber || "—",
        red: j.redItems || 0,
        amber: j.amberItems || 0,
        note: j.techNotes || "Notes will appear once technician write-up is shared.",
      }))
    : MOCK;

  return (
    <SectionShell
      id="history"
      eyebrow="Service log"
      title="Digital service history"
      count={`${history.length} visit${history.length === 1 ? "" : "s"}`}
      todo={completed.length ? null : { label: "Live completed-jobs feed not connected to this card yet" }}
      action={<GhostBtn href="#messages">Request PDF</GhostBtn>}
    >
      <ItemList>
        {history.map((v) => (
          <ItemRow
            key={v.id}
            title={v.type}
            meta={`${v.date} · ${v.mileage} miles · ${v.invoice}`}
            right={
              <div style={{ display: "flex", gap: 6 }}>
                {v.red > 0 ? <Badge tone="open">{v.red} red</Badge> : null}
                {v.amber > 0 ? <Badge>{v.amber} amber</Badge> : null}
                {v.red === 0 && v.amber === 0 ? <Badge tone="ok">All green</Badge> : null}
              </div>
            }
          >
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--txt-soft)" }}>{v.note}</p>
          </ItemRow>
        ))}
      </ItemList>
    </SectionShell>
  );
}
