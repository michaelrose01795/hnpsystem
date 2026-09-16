// file location: src/features/customers/hub/CustomerPaymentsTab.js
//
// The money view: what the customer owes, what they have paid, what is on
// account, and the records behind both.
//
// Card data is never stored or shown here. customer_payment_methods holds only
// the provider's safe reference (brand + last four + expiry), which is what the
// row renders; taking a payment always hands off to the invoice page, where the
// existing capture flow lives.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import StatusMessage from "@/components/ui/StatusMessage";
import { RecordFieldGrid, RecordHeading, StatusBadge, LinkButton } from "./RecordPrimitives";
import {
  collectPayments,
  describeInvoiceStatus,
  formatCurrency,
  formatDate,
  getInvoiceOutstanding,
  getInvoicePaid,
  getInvoiceTotal,
  splitInvoicesByStatus,
} from "@/lib/customers/customerHubModel";

function InvoiceRow({ invoice, access, onAction, busy, layer = "surface" }) {
  const Layer = layer === "theme" ? LayerTheme : LayerSurface;
  const status = describeInvoiceStatus(invoice);
  const invoiceId = invoice.id || invoice.invoice_id;

  return (
    <Layer as="article" sectionKey={`customer-profile-invoice-${invoiceId}`} parentKey="customer-profile-payments">
      <div className="app-page-header">
        <div className="app-page-header__text">
          <h3 className="app-record-heading">{`Invoice ${invoice.invoice_number || invoiceId}`}</h3>
          <p className="app-record-note">
            {[invoice.jobNumber ? `Job ${invoice.jobNumber}` : null, invoice.vehicle, formatDate(invoice.invoice_date || invoice.created_at)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="app-page-header__actions">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
      </div>

      <RecordFieldGrid
        keepEmpty
        fields={[
          { label: "Total", value: formatCurrency(getInvoiceTotal(invoice)) },
          { label: "Paid", value: formatCurrency(getInvoicePaid(invoice)) },
          { label: "Outstanding", value: formatCurrency(getInvoiceOutstanding(invoice)) },
          { label: "Due", value: invoice.due_date ? formatDate(invoice.due_date) : null },
          { label: "Method", value: invoice.payment_method },
          { label: "Sent", value: invoice.sent_email_at ? formatDate(invoice.sent_email_at) : null },
        ]}
      />

      <div className="app-record-actions">
        <LinkButton href={`/accounts/invoices/${encodeURIComponent(invoiceId)}`}>View invoice</LinkButton>
        {access?.canTakePayment && getInvoiceOutstanding(invoice) > 0 && (
          <>
            <LinkButton href={`/accounts/invoices/${encodeURIComponent(invoiceId)}`} variant="primary">
              Take payment
            </LinkButton>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onAction?.("payment_link_sent", invoice)}
            >
              Log payment link sent
            </Button>
          </>
        )}
        {access?.canIssueInvoice && getInvoiceOutstanding(invoice) <= 0 && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAction?.("receipt_sent", invoice)}>
            Log receipt sent
          </Button>
        )}
      </div>
    </Layer>
  );
}

export default function CustomerPaymentsTab({
  invoices = [],
  paymentMethods = [],
  transactions = [],
  summary,
  access,
  onRecordAction,
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const { outstanding, settled } = useMemo(() => splitInvoicesByStatus(invoices), [invoices]);
  const payments = useMemo(() => collectPayments(invoices), [invoices]);

  if (!access?.canViewFinancials) {
    return (
      <EmptyState
        variant="page"
        icon="🔒"
        title="Payments are not part of your role"
        description="Ask accounts or a manager for anything relating to this customer's balance or invoices."
      />
    );
  }

  const handleAction = async (activityType, invoice) => {
    setBusy(true);
    const ok = await onRecordAction?.({
      activityType,
      payload: {
        invoice_number: invoice?.invoice_number || null,
        amount: getInvoiceOutstanding(invoice) || getInvoiceTotal(invoice),
      },
      jobId: invoice?.jobId || null,
    });
    setFeedback(ok ? "Recorded on the customer's activity trail." : "Could not record that action.");
    setBusy(false);
  };

  const creditAvailable = Math.max(0, (summary?.creditLimit || 0) - (summary?.accountBalance || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)", minWidth: 0 }}>
      {/* Account position */}
      <LayerTheme as="section" sectionKey="customer-profile-payments" parentKey="customer-profile-tab-payments">
        <RecordHeading>Account position</RecordHeading>

        {feedback && <StatusMessage tone="info">{feedback}</StatusMessage>}

        <div className="app-summary-section">
          <div className="app-summary-grid">
            <div className="app-summary-item">
              <span className="app-summary-label">Outstanding</span>
              <span className="app-summary-value">{formatCurrency(summary?.outstandingBalance)}</span>
            </div>
            <div className="app-summary-item">
              <span className="app-summary-label">Total paid</span>
              <span className="app-summary-value">{formatCurrency(summary?.lifetimeSpend)}</span>
            </div>
            <div className="app-summary-item">
              <span className="app-summary-label">Total invoiced</span>
              <span className="app-summary-value">{formatCurrency(summary?.invoicedTotal)}</span>
            </div>
            <div className="app-summary-item">
              <span className="app-summary-label">Overdue</span>
              <span className="app-summary-value">{String(summary?.overdueCount ?? 0)}</span>
            </div>
            {summary?.accountNumbers?.length > 0 && (
              <>
                <div className="app-summary-item">
                  <span className="app-summary-label">On account</span>
                  <span className="app-summary-value">{formatCurrency(summary.accountBalance)}</span>
                </div>
                <div className="app-summary-item">
                  <span className="app-summary-label">Credit left</span>
                  <span className="app-summary-value">{formatCurrency(creditAvailable)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {summary?.accountNumbers?.length > 0 && (
          <LayerSurface as="div" sectionKey="customer-profile-account" parentKey="customer-profile-payments">
            <RecordFieldGrid
              wide
              keepEmpty
              fields={[
                { label: "Account", value: summary.accountNumbers.join(", ") },
                { label: "Type", value: summary.accountType },
                { label: "Status", value: summary.accountStatus },
                { label: "Credit limit", value: formatCurrency(summary.creditLimit) },
              ]}
            />
            {access?.canTakePayment && (
              <div className="app-record-actions">
                <LinkButton
                  href={`/accounts/transactions/${encodeURIComponent(summary.accountNumbers[0])}`}
                >
                  Open account ledger
                </LinkButton>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleAction("statement_sent", null)}
                >
                  Log statement sent
                </Button>
              </div>
            )}
          </LayerSurface>
        )}
      </LayerTheme>

      {/* Outstanding */}
      <LayerTheme
        as="section"
        sectionKey="customer-profile-payments-outstanding"
        parentKey="customer-profile-tab-payments"
      >
        <RecordHeading>{`Outstanding invoices (${outstanding.length})`}</RecordHeading>
        {outstanding.length === 0 ? (
          <EmptyState
            variant="bare"
            icon="✅"
            title="Nothing outstanding"
            description="Every invoice on this record is settled."
          />
        ) : (
          outstanding.map((invoice) => (
            <InvoiceRow
              key={invoice.id || invoice.invoice_id}
              invoice={invoice}
              access={access}
              onAction={handleAction}
              busy={busy}
            />
          ))
        )}
      </LayerTheme>

      {/* Previous payments */}
      <LayerTheme
        as="section"
        sectionKey="customer-profile-payments-received"
        parentKey="customer-profile-tab-payments"
      >
        <RecordHeading>{`Payments received (${payments.length})`}</RecordHeading>
        {payments.length === 0 ? (
          <EmptyState variant="bare" title="No payments recorded" description="Nothing has been captured against this customer yet." />
        ) : (
          <LayerSurface as="div" sectionKey="customer-profile-payments-list" parentKey="customer-profile-payments-received">
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="app-data-table app-data-table--compact">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Method</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>{formatDate(payment.payment_date || payment.created_at)}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>{payment.payment_method || "—"}</td>
                      <td>{payment.reference || "—"}</td>
                      <td>{payment.invoiceNumber || payment.jobNumber || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LayerSurface>
        )}
      </LayerTheme>

      {/* Settled invoices */}
      {settled.length > 0 && (
        <LayerTheme
          as="section"
          sectionKey="customer-profile-payments-settled"
          parentKey="customer-profile-tab-payments"
        >
          <RecordHeading>{`Settled invoices (${settled.length})`}</RecordHeading>
          {settled.slice(0, 10).map((invoice) => (
            <InvoiceRow
              key={invoice.id || invoice.invoice_id}
              invoice={invoice}
              access={access}
              onAction={handleAction}
              busy={busy}
            />
          ))}
          {settled.length > 10 && (
            <p className="app-record-note">{`Showing the 10 most recent of ${settled.length} — the History tab lists them all.`}</p>
          )}
        </LayerTheme>
      )}

      {/* Account ledger */}
      {transactions.length > 0 && (
        <LayerTheme
          as="section"
          sectionKey="customer-profile-payments-ledger"
          parentKey="customer-profile-tab-payments"
        >
          <RecordHeading>{`Account movements (${transactions.length})`}</RecordHeading>
          <LayerSurface as="div" sectionKey="customer-profile-ledger-list" parentKey="customer-profile-payments-ledger">
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="app-data-table app-data-table--compact">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Description</th>
                    <th scope="col">Job</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 50).map((transaction) => (
                    <tr key={transaction.transaction_id}>
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>{transaction.type}</td>
                      <td>{formatCurrency(transaction.amount)}</td>
                      <td>{transaction.description || "—"}</td>
                      <td>{transaction.job_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LayerSurface>
        </LayerTheme>
      )}

      {/* Stored payment methods — provider reference only */}
      <LayerTheme
        as="section"
        sectionKey="customer-profile-payment-methods"
        parentKey="customer-profile-tab-payments"
      >
        <RecordHeading>Saved payment methods</RecordHeading>
        {paymentMethods.length === 0 ? (
          <EmptyState
            variant="bare"
            title="No saved payment methods"
            description="Only the payment provider's safe reference is ever stored — never card details."
          />
        ) : (
          paymentMethods.map((method) => (
            <LayerSurface
              key={method.method_id}
              as="div"
              sectionKey={`customer-profile-payment-method-${method.method_id}`}
              parentKey="customer-profile-payment-methods"
            >
              <div className="app-page-header">
                <div className="app-page-header__text">
                  <h3 className="app-record-heading">{method.nickname || method.card_brand || "Card"}</h3>
                  <p className="app-record-note">
                    {`${method.card_brand || "Card"} ending ${method.last4} · expires ${method.expiry_month}/${method.expiry_year}`}
                  </p>
                </div>
                <div className="app-page-header__actions">
                  {method.is_default && <StatusBadge tone="success">Default</StatusBadge>}
                </div>
              </div>
            </LayerSurface>
          ))
        )}
      </LayerTheme>
    </div>
  );
}
