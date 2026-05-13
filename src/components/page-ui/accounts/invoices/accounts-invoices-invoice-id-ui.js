// file location: src/components/page-ui/accounts/invoices/accounts-invoices-invoice-id-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

// Metric tile — lives inside a LayerTheme grid (the summary section), so per the
// strict alternation rule (CLAUDE.md §3.0) it renders as a LayerSurface.
function MetricTile({ sectionKey, parentKey, label, children }) {
  return (
    <LayerSurface
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="metric-card"
      radius="var(--radius-sm)"
      padding="16px"
      gap="6px"
    >
      <p
        style={{
          margin: 0,
          color: "var(--text-1)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <div style={{ marginTop: "4px" }}>{children}</div>
    </LayerSurface>
  );
}

export default function InvoiceDetailPageUi(props) {
  const {
    Button,
    DETAIL_ROLES,
    ProtectedRoute,
    SkeletonBlock,
    SkeletonKeyframes,
    currencyFormatter,
    getAccountDisplayValue,
    getCustomerDisplayValue,
    getDueDateDisplayValue,
    getInvoiceAmountValue,
    infoRow,
    invoice,
    invoiceId,
    job,
    loading,
    notFound,
    payments,
    router,
    statusBadgeStyles,
  } = props;

  if (props.view !== "section1") return null;

  const statusPalette = invoice
    ? statusBadgeStyles[invoice.payment_status] || {
        background: "rgba(var(--primary-rgb), 0.14)",
        color: "var(--text-accent)",
      }
    : null;

  return (
    <ProtectedRoute allowedRoles={DETAIL_ROLES}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Header — Theme section directly under app-layout-page-card (Surface). Single row. */}
        <LayerTheme
          as="section"
          sectionKey="invoice-detail-header"
          parentKey="app-layout-page-card"
          sectionType="page-header"
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 auto" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "1.6rem",
                color: "var(--text-1)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {invoice?.invoice_number || invoiceId}
            </h1>
            {statusPalette && (
              <span
                className="app-btn app-btn--sm"
                aria-label={`Status: ${invoice.payment_status || "Draft"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                  pointerEvents: "none",
                  ...statusPalette,
                }}
              >
                {invoice.payment_status || "Draft"}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/accounts/invoices")}
            style={{ flex: "0 0 auto" }}
          >
            All Invoices
          </Button>
        </LayerTheme>

        {/* Skeleton — shown while loading OR before we know whether the invoice exists */}
        {(loading || (!invoice && !notFound)) && (
          <>
            <SkeletonKeyframes />
            <LayerTheme
              as="section"
              sectionKey="invoice-detail-summary-grid"
              parentKey="app-layout-page-card"
              sectionType="metric-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <LayerSurface
                  key={i}
                  sectionKey={`invoice-detail-summary-skeleton-${i}`}
                  parentKey="invoice-detail-summary-grid"
                  sectionType="metric-card"
                  radius="var(--radius-sm)"
                  padding="16px"
                  gap="10px"
                >
                  <SkeletonBlock width="50%" height="10px" />
                  <SkeletonBlock width="70%" height="24px" />
                </LayerSurface>
              ))}
            </LayerTheme>
            <LayerTheme
              as="section"
              sectionKey="invoice-detail-body-skeleton"
              parentKey="app-layout-page-card"
              sectionType="content-card"
              gap="10px"
            >
              <SkeletonBlock width="20%" height="16px" />
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} width={i % 2 === 0 ? "100%" : "88%"} height="14px" />
              ))}
            </LayerTheme>
          </>
        )}

        {/* Loaded */}
        {!loading && invoice && (
          <>
            {/* Summary grid — Theme directly under page-card, with Surface metric cards inside */}
            <LayerTheme
              as="section"
              sectionKey="invoice-detail-summary-grid"
              parentKey="app-layout-page-card"
              sectionType="metric-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <MetricTile
                sectionKey="invoice-detail-summary-grand-total"
                parentKey="invoice-detail-summary-grid"
                label="Grand Total"
              >
                <strong style={{ display: "block", fontSize: "1.6rem", color: "var(--text-accent)" }}>
                  {currencyFormatter.format(getInvoiceAmountValue(invoice))}
                </strong>
              </MetricTile>

              <MetricTile
                sectionKey="invoice-detail-summary-due-date"
                parentKey="invoice-detail-summary-grid"
                label="Due Date"
              >
                <strong style={{ display: "block", fontSize: "1.05rem", color: "var(--text-1)" }}>
                  {getDueDateDisplayValue(invoice)}
                </strong>
              </MetricTile>

              <MetricTile
                sectionKey="invoice-detail-summary-account"
                parentKey="invoice-detail-summary-grid"
                label="Account"
              >
                <strong style={{ display: "block", fontSize: "1.05rem", color: "var(--text-1)" }}>
                  {getAccountDisplayValue(invoice)}
                </strong>
              </MetricTile>

              <MetricTile
                sectionKey="invoice-detail-summary-customer"
                parentKey="invoice-detail-summary-grid"
                label="Customer"
              >
                <strong style={{ display: "block", fontSize: "1.05rem", color: "var(--text-1)" }}>
                  {getCustomerDisplayValue(invoice)}
                </strong>
              </MetricTile>

              <MetricTile
                sectionKey="invoice-detail-summary-job"
                parentKey="invoice-detail-summary-grid"
                label="Job"
              >
                <strong style={{ display: "block", fontSize: "1.05rem", color: "var(--text-1)" }}>
                  {invoice.job_number || "—"}
                </strong>
              </MetricTile>
            </LayerTheme>

            {/* Two-column body on wide screens: payments + linked job */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              <LayerTheme
                as="section"
                sectionKey="invoice-detail-payment-history"
                parentKey="app-layout-page-card"
                sectionType="content-card"
                gap="12px"
              >
                <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: "1.2rem" }}>Payment History</h2>
                {payments.length === 0 && (
                  <p style={{ margin: 0, color: "var(--text-1)" }}>No payments recorded.</p>
                )}
                {payments.map((payment) => (
                  <LayerSurface
                    key={payment.payment_id}
                    sectionKey={`invoice-detail-payment-row-${payment.payment_id}`}
                    parentKey="invoice-detail-payment-history"
                    sectionType="list-row"
                    radius="var(--radius-sm)"
                    padding="12px 14px"
                    gap="0"
                    style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}
                  >
                    <div>
                      <strong style={{ color: "var(--text-1)" }}>
                        {currencyFormatter.format(Number(payment.amount || 0))}
                      </strong>
                      <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.85rem" }}>
                        {payment.method || payment.payment_method || "—"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-1)" }}>
                        {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-GB") : "—"}
                      </p>
                      <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.85rem" }}>
                        {payment.reference || "Manual"}
                      </p>
                    </div>
                  </LayerSurface>
                ))}
              </LayerTheme>

              <LayerTheme
                as="section"
                sectionKey="invoice-detail-linked-job"
                parentKey="app-layout-page-card"
                sectionType="content-card"
                gap="12px"
              >
                <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: "1.2rem" }}>Linked Job Card</h2>
                {job ? (
                  <LayerSurface
                    sectionKey="invoice-detail-linked-job-card"
                    parentKey="invoice-detail-linked-job"
                    sectionType="info-card"
                    radius="var(--radius-sm)"
                    padding="4px 16px"
                    gap="4px"
                  >
                    {infoRow("Job Number", job.job_number)}
                    {infoRow("Status", job.status)}
                    {infoRow("Vehicle", job.vehicle || job.reg)}
                    {infoRow("Advisor", job.advisor || job.service_advisor)}
                  </LayerSurface>
                ) : (
                  <p style={{ margin: 0, color: "var(--text-1)" }}>No job card linked.</p>
                )}
              </LayerTheme>
            </div>
          </>
        )}

        {/* Only show after the API definitively returns 404 */}
        {!loading && !invoice && notFound && (
          <p style={{ color: "var(--danger)" }}>Invoice not found.</p>
        )}
      </div>
    </ProtectedRoute>
  );
}
