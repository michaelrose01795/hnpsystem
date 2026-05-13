// file location: src/features/customerPortal/components/sections/DocumentsCentreCard.js
// Customer documents assembled from live invoices and VHC media. A dedicated
// customer documents upload/index API is still required.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, ItemList, ItemRow, GhostBtn, Empty } from "./_websiteParts";

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

export default function DocumentsCentreCard({ invoices = [], vhcMedia = [] }) {
  const docs = [
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.invoice_id || invoice.id}`,
      name: invoice.invoice_number || invoice.invoice_id || "Invoice",
      meta: `Invoice - ${formatDate(invoice.created_at)} - ${invoice.payment_status || "Draft"}`,
      href: invoice.invoice_id ? `/accounts/invoices/${invoice.invoice_id}` : null,
    })),
    ...vhcMedia.map((item) => ({
      id: `media-${item.id}`,
      name: item.context_label || `${item.media_type || "VHC"} media`,
      meta: `Inspection media - ${formatDate(item.created_at)}`,
      href: item.public_url,
    })),
  ];

  return (
    <SectionShell
      id="documents"
      eyebrow="Files"
      title="Documents centre"
      action={<GhostBtn href="#messages">Request upload</GhostBtn>}
      todo={{
        label: "Customer documents API + upload endpoint not wired yet",
        detail: "Invoices and VHC media are live. Customer-uploaded documents still need a customer-scoped index and upload route.",
      }}
    >
      <Tile padding={14}>
        {docs.length === 0 ? (
          <Empty>No invoice or VHC media documents are linked to this account yet.</Empty>
        ) : (
          <ItemList>
            {docs.map((doc) => (
              <ItemRow
                key={doc.id}
                title={doc.name}
                meta={doc.meta}
                right={doc.href ? <GhostBtn href={doc.href}>Open</GhostBtn> : null}
              />
            ))}
          </ItemList>
        )}
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
          Customer uploads will appear here once the upload endpoint is connected.
        </div>
      </Tile>
    </SectionShell>
  );
}
