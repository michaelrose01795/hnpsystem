// file location: src/features/customerPortal/components/sections/DocumentsCentreCard.js
// Customer documents: PDFs (invoices, V5s, warranty, inspection sheets) and
// customer-uploaded docs. Storage buckets exist; the per-customer index +
// upload endpoint are TBC, so mock listing for now.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn } from "./_websiteParts";

const MOCK_DOCS = [
  { id: "d1", name: "Invoice INV-10421.pdf", type: "Invoice", size: "128 KB", uploaded: "14 Mar 2026", by: "H&P" },
  { id: "d2", name: "V5C copy.pdf", type: "Registration", size: "256 KB", uploaded: "02 Jan 2025", by: "You" },
  { id: "d3", name: "Warranty schedule.pdf", type: "Warranty", size: "512 KB", uploaded: "11 Jul 2024", by: "H&P" },
  { id: "d4", name: "Inspection sheet · JOB-22481.pdf", type: "Inspection", size: "440 KB", uploaded: "15 Mar 2026", by: "H&P" },
];

export default function DocumentsCentreCard() {
  return (
    <SectionShell
      id="documents"
      eyebrow="Files"
      title="Documents centre"
      action={<GhostBtn>Upload a document</GhostBtn>}
      todo={{
        label: "Customer documents API + upload endpoint not wired yet",
        detail: "Supabase storage buckets exist; what's missing is the per-customer documents index endpoint and the upload route.",
      }}
    >
      <Tile padding={14}>
        <ItemList>
          {MOCK_DOCS.map((d) => (
            <ItemRow
              key={d.id}
              title={d.name}
              meta={`${d.type} · ${d.size} · ${d.uploaded} · uploaded by ${d.by}`}
              right={<GhostBtn>Download</GhostBtn>}
            />
          ))}
        </ItemList>
      </Tile>

      <Tile padding={16}>
        <SubHeader>Upload zone</SubHeader>
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
            color: "var(--txt-soft)",
            fontSize: 13,
          }}
        >
          Drag &amp; drop documents here, or use the upload button above.
        </div>
      </Tile>
    </SectionShell>
  );
}
