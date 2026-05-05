// file location: src/components/page-ui/accounts/invoices/accounts-invoices-invoice-id-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

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
    payments,
    router,
    statusBadgeStyles,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={DETAIL_ROLES}>
      <>
        <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
          <LayerSurface as="section" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "12px",
        alignItems: "start"
      }}>
            <div style={{
          minWidth: 0
        }}>
              <h1 style={{
            margin: 0,
            fontSize: "2rem",
            color: "var(--text-1)"
          }}>Invoice {invoice?.invoice_number || invoiceId}</h1>
            </div>
            <div style={{
          display: "flex",
          justifyContent: "flex-end"
        }}>
              <Button type="button" variant="secondary" onClick={() => router.push("/accounts/invoices")}>All Invoices</Button>
            </div>
          </LayerSurface>
          {loading && <>
              <SkeletonKeyframes />
              <LayerSurface as="section" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}>
                {Array.from({
            length: 4
          }).map((_, i) => <LayerTheme key={i} radius="var(--radius-sm)" padding="16px" gap="10px">
                    <SkeletonBlock width="50%" height="10px" />
                    <SkeletonBlock width="70%" height="24px" />
                    <SkeletonBlock width="40%" height="10px" />
                  </LayerTheme>)}
              </LayerSurface>
              <LayerSurface as="section" gap="10px">
                <SkeletonBlock width="20%" height="16px" />
                {Array.from({
            length: 4
          }).map((_, i) => <SkeletonBlock key={i} width={i % 2 === 0 ? "100%" : "88%"} height="14px" />)}
              </LayerSurface>
            </>}
          {!loading && invoice && <>
              <LayerSurface as="section" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Grand Total</p>
                  <strong style={{
              display: "block",
              marginTop: "10px",
              fontSize: "1.8rem",
              color: "var(--text-1)"
            }}>{currencyFormatter.format(getInvoiceAmountValue(invoice))}</strong>
                </LayerTheme>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Payment Status</p>
                  <span style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: "10px",
              padding: "4px 12px",
              borderRadius: "var(--radius-pill)",
              fontWeight: 600,
              ...(statusBadgeStyles[invoice.payment_status] || {
                background: "rgba(var(--primary-rgb), 0.14)",
                color: "var(--primary-selected)"
              })
            }}>{invoice.payment_status || "Draft"}</span>
                </LayerTheme>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Due Date</p>
                  <strong style={{
              display: "block",
              marginTop: "10px",
              color: "var(--text-1)"
            }}>{getDueDateDisplayValue(invoice)}</strong>
                </LayerTheme>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Account</p>
                  <strong style={{
              display: "block",
              marginTop: "10px",
              color: "var(--text-1)"
            }}>{getAccountDisplayValue(invoice)}</strong>
                </LayerTheme>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Customer</p>
                  <strong style={{
              display: "block",
              marginTop: "10px",
              color: "var(--text-1)"
            }}>{getCustomerDisplayValue(invoice)}</strong>
                </LayerTheme>
                <LayerTheme radius="var(--radius-sm)" padding="16px">
                  <p style={{
              margin: 0,
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.8rem"
            }}>Job</p>
                  <strong style={{
              display: "block",
              marginTop: "10px",
              color: "var(--text-1)"
            }}>{invoice.job_number || "—"}</strong>
                </LayerTheme>
              </LayerSurface>
              <LayerSurface as="section" gap="8px">
                <h2 style={{
            margin: 0,
            color: "var(--text-1)",
            fontSize: "1.25rem"
          }}>Payment History</h2>
                {payments.length === 0 && <p style={{
            color: "var(--text-1)"
          }}>No payments recorded.</p>}
                {payments.map(payment => <LayerTheme key={payment.payment_id} radius="var(--radius-sm)" padding="12px 14px" gap="0" style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between"
          }}>
                    <div>
                      <strong style={{
                color: "var(--text-1)"
              }}>{currencyFormatter.format(Number(payment.amount || 0))}</strong>
                      <p style={{
                margin: 0,
                color: "var(--text-1)"
              }}>{payment.method || payment.payment_method || "—"}</p>
                    </div>
                    <div style={{
              textAlign: "right"
            }}>
                      <p style={{
                margin: 0,
                fontWeight: 600,
                color: "var(--text-1)"
              }}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-GB") : "—"}</p>
                      <p style={{
                margin: 0,
                color: "var(--text-1)"
              }}>{payment.reference || "Manual"}</p>
                    </div>
                  </LayerTheme>)}
              </LayerSurface>
              <LayerSurface as="section" gap="8px">
                <h2 style={{
            margin: 0,
            color: "var(--text-1)",
            fontSize: "1.25rem"
          }}>Linked Job Card</h2>
                {job ? <LayerTheme radius="var(--radius-sm)" padding="4px 16px" gap="4px">
                    {infoRow("Job Number", job.job_number)}
                    {infoRow("Status", job.status)}
                    {infoRow("Vehicle", job.vehicle || job.reg)}
                    {infoRow("Advisor", job.advisor || job.service_advisor)}
                  </LayerTheme> : <p style={{
            color: "var(--text-1)"
          }}>No job card linked.</p>}
              </LayerSurface>
            </>}
          {!loading && !invoice && <p style={{
        color: "var(--danger)"
      }}>Invoice not found.</p>}
        </div>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
