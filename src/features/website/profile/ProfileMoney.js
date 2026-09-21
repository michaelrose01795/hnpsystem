// file location: src/features/website/profile/ProfileMoney.js
//
// The Money view. Everything financial that used to be scattered across the
// Money, Payments, and "Payments, finance & signatures" sections is grouped
// here behind one outstanding-balance figure and three subsections:
//
//   Invoices | Payments | Cards & plans
//
// Actions (pay, PDF, statement) are handed back to the page, which owns the
// single /api/website/actions call — the verbs are unchanged.

import {
  ExpandableList,
  NotAvailableYet,
  PortalCard,
  SubNav,
  ViewHeading,
} from "./ProfilePrimitives";
import { formatCurrency, formatDate, invoiceRef, invoiceTotal, isPaidInvoice } from "./profileUtils";

const SECTIONS = [
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "methods", label: "Cards & plans" },
];

export default function ProfileMoney({
  accounts,
  invoices,
  outstandingInvoices,
  outstandingTotal,
  invoicePayments,
  paymentMethods,
  paymentPlans,
  transactions,
  section,
  onSectionChange,
  onPayInvoice,
  onRequestInvoicePdf,
  onRequestStatement,
  actionFlash,
}) {
  return (
    <div className="ws-profile-view" data-presentation="website-profile-money">
      {/* The one number a customer opens this view for. */}
      <PortalCard eyebrow="Your balance" title="Outstanding" presentation="website-profile-balance" wide>
        <div className="ws-portal-balance">
          <span className="ws-portal-balance__figure">{formatCurrency(outstandingTotal)}</span>
          <span className="ws-portal-hint">
            {outstandingInvoices.length
              ? `Across ${outstandingInvoices.length} invoice${outstandingInvoices.length === 1 ? "" : "s"}`
              : "Nothing to pay — you're all settled."}
          </span>
        </div>
        {accounts.length ? (
          <ul className="ws-portal-list">
            {accounts.map((a) => (
              <li key={a.account_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{a.account_type || "Account"}</div>
                  <div className="ws-portal-item-meta">
                    Balance {formatCurrency(a.balance)} · credit limit {formatCurrency(a.credit_limit)} ·{" "}
                    {a.credit_terms ?? 30}-day terms
                  </div>
                  {actionFlash[`stmt-${a.account_id}`] ? (
                    <p className="ws-portal-flash">{actionFlash[`stmt-${a.account_id}`]}</p>
                  ) : null}
                </div>
                <button type="button" onClick={() => onRequestStatement(a)}>
                  Request statement
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </PortalCard>

      <SubNav
        label="Money sections"
        items={SECTIONS}
        value={section}
        onChange={onSectionChange}
        idPrefix="ws-profile-money"
      />

      {section === "invoices" ? (
        <PortalCard eyebrow="Billing" title="Invoices" count={invoices.length} wide>
          <ExpandableList
            items={invoices}
            initial={5}
            moreLabel="View all invoices"
            emptyText="You don't have any invoices on your account yet."
            renderItem={(invoice) => {
              const paid = isPaidInvoice(invoice);
              return (
                <li key={invoice.invoice_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">
                      {[invoiceRef(invoice), invoice.job_number].filter(Boolean).join(" · ")}
                    </div>
                    <div className="ws-portal-item-meta">
                      {[
                        formatDate(invoice.created_at),
                        formatCurrency(invoiceTotal(invoice)),
                        invoice.due_date ? `due ${formatDate(invoice.due_date)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {actionFlash[`pay-${invoice.invoice_id}`] ? (
                      <p className="ws-portal-flash">{actionFlash[`pay-${invoice.invoice_id}`]}</p>
                    ) : null}
                    {actionFlash[`pdf-${invoice.invoice_id}`] ? (
                      <p className="ws-portal-flash">{actionFlash[`pdf-${invoice.invoice_id}`]}</p>
                    ) : null}
                  </div>
                  <div className="ws-portal-action-row ws-portal-actions-end">
                    <span className="ws-portal-badge" data-tone={paid ? "ok" : "open"}>
                      {paid ? "Paid" : invoice.payment_status || "To pay"}
                    </span>
                    {!paid ? (
                      <button type="button" className="app-btn" onClick={() => onPayInvoice(invoice)}>
                        Pay
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onRequestInvoicePdf(invoice)}>
                      PDF
                    </button>
                  </div>
                </li>
              );
            }}
          />
        </PortalCard>
      ) : null}

      {section === "payments" ? (
        <div className="ws-portal-split">
          <PortalCard eyebrow="Payments" title="What you've paid" count={invoicePayments.length}>
            <ExpandableList
              items={invoicePayments}
              initial={5}
              emptyText="No payments have been recorded on your account yet."
              renderItem={(payment) => (
                <li key={payment.payment_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">
                      {formatCurrency(payment.amount)} · {payment.payment_method || "Payment"}
                    </div>
                    <div className="ws-portal-item-meta">
                      {[formatDate(payment.payment_date), payment.reference].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="ws-portal-badge" data-tone="ok">
                    Paid
                  </span>
                </li>
              )}
            />
          </PortalCard>

          <PortalCard eyebrow="Statement" title="Account activity" count={transactions.length}>
            {transactions.length === 0 ? (
              <p className="ws-portal-empty">No account transactions are recorded yet.</p>
            ) : (
              <div className="ws-portal-ledger">
                {transactions.slice(0, 20).map((t) => {
                  const isCredit = String(t.type || "").toLowerCase() === "credit" || Number(t.amount) < 0;
                  return (
                    <div key={t.transaction_id} className="ws-portal-ledger__row">
                      <span className="ws-portal-ledger__meta">{formatDate(t.transaction_date)}</span>
                      <span>
                        <div>{t.description || t.type}</div>
                        {t.job_number ? (
                          <div className="ws-portal-ledger__meta">
                            {[t.job_number, t.payment_method].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                      </span>
                      <span className="ws-portal-ledger__amount" data-tone={isCredit ? "credit" : "debit"}>
                        {isCredit ? "−" : ""}
                        {formatCurrency(Math.abs(Number(t.amount)))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </PortalCard>
        </div>
      ) : null}

      {section === "methods" ? (
        <div className="ws-portal-split">
          <PortalCard eyebrow="Cards" title="Saved payment methods" count={paymentMethods.length}>
            {paymentMethods.length === 0 ? (
              <p className="ws-portal-empty">You have no saved cards.</p>
            ) : (
              <ul className="ws-portal-list">
                {paymentMethods.map((p) => (
                  <li key={p.method_id} className="ws-portal-detail">
                    <span className="ws-portal-chip__brand">
                      {p.card_brand || "Card"} {p.is_default ? "· Default" : ""}
                    </span>
                    <span className="ws-portal-chip__line">
                      •••• {p.last4 || "----"} · expires {String(p.expiry_month || "").padStart(2, "0")}/
                      {String(p.expiry_year || "").slice(-2)}
                    </span>
                    {p.nickname ? <span className="ws-portal-chip__line">{p.nickname}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard eyebrow="Plans" title="Payment plans" count={paymentPlans.length}>
            {paymentPlans.length === 0 ? (
              <p className="ws-portal-empty">You have no payment plans with us.</p>
            ) : (
              <ul className="ws-portal-list">
                {paymentPlans.map((plan) => (
                  <li key={plan.plan_id} className="ws-portal-row">
                    <div>
                      <div className="ws-portal-item-title">{plan.name || plan.description || "Payment plan"}</div>
                      <div className="ws-portal-item-meta">
                        {formatCurrency(plan.balance_due)} left · next payment {formatDate(plan.next_payment_date)}
                      </div>
                    </div>
                    <span
                      className="ws-portal-badge"
                      data-tone={String(plan.status).toLowerCase() === "active" ? "ok" : undefined}
                    >
                      {plan.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <NotAvailableYet>
              Signed paperwork is not shown here yet — ask us and we&apos;ll send a copy.
            </NotAvailableYet>
          </PortalCard>
        </div>
      ) : null}

      <ViewHeading
        title="Something not right?"
        hint="If an invoice or payment looks wrong, send us a message and we'll sort it."
      />
    </div>
  );
}
