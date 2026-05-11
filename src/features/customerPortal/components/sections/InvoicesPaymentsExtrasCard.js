// file location: src/features/customerPortal/components/sections/InvoicesPaymentsExtrasCard.js
// Extras layered on top of the existing Invoices / Payment methods cards:
// payment history, finance documents, signature ledger, account statement.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn } from "./_websiteParts";

const MOCK_PAYMENTS = [
  { id: "p1", date: "15 Mar 2026", method: "Klarna", reference: "INV-10421", amount: 612.4, status: "Paid" },
  { id: "p2", date: "07 Aug 2025", method: "Card · ****4242", reference: "INV-9712", amount: 184.6, status: "Paid" },
  { id: "p3", date: "22 Jan 2025", method: "Bumper · 4 months", reference: "INV-9123", amount: 1245.0, status: "Plan complete" },
];

const MOCK_FINANCE = [
  { id: "f1", title: "PCP agreement (Vehicle DEMO123)", expires: "06 Aug 2027" },
  { id: "f2", title: "Service plan T&Cs", expires: "—" },
];

const MOCK_SIGS = [
  { id: "s1", document: "Job authorisation · JOB-22481", signedAt: "Mon 11:18" },
  { id: "s2", document: "Courtesy car insurance acknowledgement", signedAt: "Mon 11:20" },
];

export default function InvoicesPaymentsExtrasCard() {
  return (
    <SectionShell
      id="payments-extras"
      eyebrow="Account"
      title="Payments, finance & signatures"
      todo={{
        label: "Payment history feed, finance store and signature ledger not wired yet",
        detail: "invoice_payments / payment_plans tables exist; what's missing is a customer-scoped read endpoint plus the signature capture flow.",
      }}
    >
      <Tile padding={14}>
        <SubHeader>Payment history</SubHeader>
        <ItemList>
          {MOCK_PAYMENTS.map((p) => (
            <ItemRow
              key={p.id}
              title={`£${p.amount.toFixed(2)} · ${p.method}`}
              meta={`${p.date} · ${p.reference}`}
              right={<Badge tone="ok">{p.status}</Badge>}
            />
          ))}
        </ItemList>
      </Tile>

      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Finance documents</SubHeader>
          <ItemList>
            {MOCK_FINANCE.map((d) => (
              <ItemRow key={d.id} title={d.title} meta={`Expires ${d.expires}`} />
            ))}
          </ItemList>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Digital signatures</SubHeader>
          <ItemList>
            {MOCK_SIGS.map((s) => (
              <ItemRow key={s.id} title={s.document} meta={`Signed ${s.signedAt}`} />
            ))}
          </ItemList>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Account statement</SubHeader>
          <p style={{ margin: 0, fontSize: 13, color: "var(--txt-soft)" }}>
            Download a full statement of your account with H&P.
          </p>
          <GhostBtn style={{ alignSelf: "flex-start" }}>Download statement</GhostBtn>
        </Tile>
      </Grid>
    </SectionShell>
  );
}
