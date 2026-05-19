// file location: src/components/page-ui/accounts/view/accounts-view-account-id-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

// Status → staffglobal .app-badge tone modifier.
const statusToneClass = (status) => {
  if (status === "Frozen") return "app-badge--warning";
  if (status === "Closed") return "app-badge--danger";
  return "app-badge--success";
};

export default function ViewAccountPageUi(props) {
  const {
    Button,
    DevLayoutSection,
    InvoiceTable,
    ProtectedRoute,
    SkeletonBlock,
    SkeletonKeyframes,
    TransactionTable,
    VIEW_ROLES,
    account,
    currencyFormatter,
    detailCard,
    filters,
    handleEdit,
    handleFreezeToggle,
    handleInvoicesPage,
    handleTransactionsPage,
    invoiceFilters,
    invoices,
    loading,
    notFound,
    permissions,
    router,
    setFilters,
    setInvoiceFilters,
    transactions,
  } = props; // receive page logic props.

  // The page sits in the skeleton state until we have a definitive answer —
  // either an account loaded, or the server confirmed it's not there.
  const showSkeleton = loading || (!account && !notFound);

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={VIEW_ROLES}>
      <>
        <DevLayoutSection sectionKey="account-view-page-shell" sectionType="page-shell" shell>
        <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
          {showSkeleton && <>
              <SkeletonKeyframes />
              {/* Header skeleton — mirrors the real --theme header card. */}
              <LayerTheme as="section" gap="14px">
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap"
            }}>
                  <SkeletonBlock width="280px" height="28px" />
                  <div style={{
                display: "flex",
                gap: 10
              }}>
                    <SkeletonBlock width="120px" height="36px" borderRadius="var(--radius-pill)" />
                    <SkeletonBlock width="120px" height="36px" borderRadius="var(--radius-pill)" />
                  </div>
                </div>
                <SkeletonBlock width="60%" height="12px" />
                <SkeletonBlock width="50%" height="12px" />
              </LayerTheme>
              {/* Overview skeleton — --theme card holding --surface metric tiles. */}
              <LayerTheme as="section" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16
          }}>
                {Array.from({
              length: 4
            }).map((_, i) => <LayerSurface key={i} radius="var(--radius-sm)" padding="16px" gap="8px">
                    <SkeletonBlock width="50%" height="10px" />
                    <SkeletonBlock width="80%" height="22px" />
                    <SkeletonBlock width="40%" height="10px" />
                  </LayerSurface>)}
              </LayerTheme>
            </>}
          {!showSkeleton && account && <>
              {/* Header — --theme card; identity, chips and actions on one wrapping row. */}
              <LayerTheme as="section" sectionKey="account-view-header" sectionType="content-card" parentKey="account-view-page-shell" gap="16px">
                <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px"
            }}>
                  <h1 style={{
                margin: 0,
                fontSize: "clamp(1.3rem, 2.4vw, 1.75rem)",
                color: "var(--text-1)"
              }}>{account.billing_name || account.account_id}</h1>
                  <span className="app-badge app-badge--neutral app-badge--control">ID: {account.account_id}</span>
                  <span className="app-badge app-badge--neutral app-badge--control">Customer: {account.customer_id || "—"}</span>
                  <span className="app-badge app-badge--neutral app-badge--control">Type: {account.account_type}</span>
                  <span className={`app-badge app-badge--control ${statusToneClass(account.status)}`}>{account.status}</span>
                  <div style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginLeft: "auto"
              }}>
                    <Button type="button" variant="secondary" onClick={handleTransactionsPage}>Transactions</Button>
                    <Button type="button" variant="secondary" onClick={handleInvoicesPage}>Invoices</Button>
                    {permissions.canEditAccount && <Button type="button" variant="secondary" onClick={handleEdit}>Edit</Button>}
                    {permissions.canFreezeAccount && <Button type="button" onClick={handleFreezeToggle}>{account.status === "Frozen" ? "Unfreeze" : "Freeze"}</Button>}
                  </div>
                </div>
              </LayerTheme>
              {/* Overview — --theme card holding three --surface sections. */}
              <LayerTheme as="section" sectionKey="account-view-overview-card" sectionType="content-card" parentKey="account-view-page-shell" gap="16px">
                <LayerSurface
              as="section"
              sectionKey="account-view-metrics-grid"
              sectionType="content-card"
              parentKey="account-view-overview-card"
              radius="var(--radius-sm)"
              padding="16px">
                  <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px"
              }}>
                    {detailCard("Balance", currencyFormatter.format(Number(account.balance || 0)))}
                    {detailCard("Credit Limit", currencyFormatter.format(Number(account.credit_limit || 0)))}
                    {detailCard("Credit Terms", `${account.credit_terms || 0} days`)}
                    {detailCard("Created", account.created_at ? new Date(account.created_at).toLocaleDateString("en-GB") : "—")}
                  </div>
                </LayerSurface>
                <LayerSurface
              as="section"
              sectionKey="account-view-billing-section"
              sectionType="content-card"
              parentKey="account-view-overview-card"
              radius="var(--radius-sm)"
              padding="16px"
              gap="14px">
                  <h2 style={{
                margin: 0,
                color: "var(--text-1)",
                fontSize: "1.2rem"
              }}>Billing Information</h2>
                  <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px"
              }}>
                    <div><p style={{
                    margin: 0,
                    color: "var(--text-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.75rem"
                  }}>Name</p><strong style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--text-1)"
                  }}>{account.billing_name || "—"}</strong></div>
                    <div><p style={{
                    margin: 0,
                    color: "var(--text-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.75rem"
                  }}>Email</p><strong style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--text-1)"
                  }}>{account.billing_email || "—"}</strong></div>
                    <div><p style={{
                    margin: 0,
                    color: "var(--text-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.75rem"
                  }}>Phone</p><strong style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--text-1)"
                  }}>{account.billing_phone || "—"}</strong></div>
                    <div><p style={{
                    margin: 0,
                    color: "var(--text-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.75rem"
                  }}>Address</p><strong style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--text-1)"
                  }}>{[account.billing_address_line1, account.billing_address_line2, account.billing_city, account.billing_postcode, account.billing_country].filter(Boolean).join(", ") || "—"}</strong></div>
                  </div>
                </LayerSurface>
                <LayerSurface
              as="section"
              sectionKey="account-view-notes-section"
              sectionType="content-card"
              parentKey="account-view-overview-card"
              radius="var(--radius-sm)"
              padding="16px"
              gap="12px">
                  <h2 style={{
                margin: 0,
                color: "var(--text-1)",
                fontSize: "1.2rem"
              }}>Internal Notes</h2>
                  <p style={{
                margin: 0,
                color: "var(--text-1)",
                lineHeight: 1.6
              }}>{account.notes || "No notes recorded."}</p>
                </LayerSurface>
              </LayerTheme>
              <DevLayoutSection sectionKey="account-view-transactions" sectionType="data-table" parentKey="account-view-page-shell">
              <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={{
              page: 1,
              pageSize: transactions.length || 1,
              total: transactions.length || 0
            }} onPageChange={handleTransactionsPage} onExport={() => router.push(`/accounts/transactions/${account.account_id}`)} accentSurface />
              </DevLayoutSection>
              <DevLayoutSection sectionKey="account-view-invoices" sectionType="data-table" parentKey="account-view-page-shell">
              <InvoiceTable invoices={invoices} filters={invoiceFilters} onFilterChange={setInvoiceFilters} pagination={{
              page: 1,
              pageSize: invoices.length || 1,
              total: invoices.length || 0
            }} onPageChange={handleInvoicesPage} onExport={() => router.push(`/accounts/invoices?accountId=${account.account_id}`)} loading={loading} accentSurface />
              </DevLayoutSection>
            </>}
          {!showSkeleton && !account && notFound &&
            <p className="app-status-message app-status-message--danger" style={{ margin: 0 }}>Account not found.</p>}
        </div>
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
