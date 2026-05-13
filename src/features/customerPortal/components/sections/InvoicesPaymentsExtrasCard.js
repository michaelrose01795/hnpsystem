// file location: src/features/customerPortal/components/sections/InvoicesPaymentsExtrasCard.js
// Payment history and plans from customer-scoped invoice/account tables.
import React from "react";
import SectionShell from "./SectionShell";
import { Grid, Tile, SubHeader, ItemList, ItemRow, Badge, GhostBtn, Empty } from "./_websiteParts";

const formatCurrency = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "£0.00";
  return number.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

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

export default function InvoicesPaymentsExtrasCard({
  invoicePayments = [],
  paymentPlans = [],
  transactions = [],
}) {
  return (
    <SectionShell
      id="payments-extras"
      eyebrow="Account"
      title="Payments, finance & signatures"
      todo={{
        label: "Signature ledger not wired yet",
        detail: "Payment history, payment plans and account transactions are live where records exist. Digital signature capture still needs a customer-facing workflow.",
      }}
    >
      <Tile padding={14}>
        <SubHeader>Payment history</SubHeader>
        {invoicePayments.length === 0 ? (
          <Empty>No invoice payments have been recorded for this account yet.</Empty>
        ) : (
          <ItemList>
            {invoicePayments.map((payment) => (
              <ItemRow
                key={payment.payment_id}
                title={`${formatCurrency(payment.amount)} - ${payment.payment_method || "Payment"}`}
                meta={`${formatDate(payment.payment_date)} - ${payment.reference || "No reference"}`}
                right={<Badge tone="ok">Paid</Badge>}
              />
            ))}
          </ItemList>
        )}
      </Tile>

      <Grid min={260}>
        <Tile padding={14}>
          <SubHeader>Payment plans</SubHeader>
          {paymentPlans.length === 0 ? (
            <Empty>No active payment plans are linked to this account.</Empty>
          ) : (
            <ItemList>
              {paymentPlans.map((plan) => (
                <ItemRow
                  key={plan.plan_id}
                  title={plan.name || plan.description || "Payment plan"}
                  meta={`${formatCurrency(plan.balance_due)} balance - next ${formatDate(plan.next_payment_date)}`}
                  right={<Badge tone={String(plan.status).toLowerCase() === "active" ? "ok" : "neutral"}>{plan.status}</Badge>}
                />
              ))}
            </ItemList>
          )}
        </Tile>

        <Tile padding={14}>
          <SubHeader>Digital signatures</SubHeader>
          <Empty>Digital signature records will appear once the signature ledger is connected.</Empty>
        </Tile>

        <Tile padding={14}>
          <SubHeader>Account statement</SubHeader>
          {transactions.length === 0 ? (
            <Empty>No account transactions are linked to this account.</Empty>
          ) : (
            <ItemList>
              {transactions.slice(0, 5).map((transaction) => (
                <ItemRow
                  key={transaction.transaction_id}
                  title={transaction.description || transaction.type}
                  meta={`${formatDate(transaction.transaction_date)} - ${transaction.job_number || "Account"}`}
                  right={<Badge>{formatCurrency(transaction.amount)}</Badge>}
                />
              ))}
            </ItemList>
          )}
          <GhostBtn href="#messages" style={{ alignSelf: "flex-start" }}>Request full statement</GhostBtn>
        </Tile>
      </Grid>
    </SectionShell>
  );
}
