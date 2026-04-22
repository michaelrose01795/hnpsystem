// file location: src/components/page-ui/accounts/view/accounts-view-account-id-ui.js

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
    permissions,
    router,
    setFilters,
    setInvoiceFilters,
    statusBadgeStyles,
    transactions,
  } = props; // receive page logic props.

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
          {loading && <>
              <SkeletonKeyframes />
              <section className="app-section-card" style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "rgba(var(--primary-rgb), 0.08)",
            border: "1px solid rgba(var(--primary-rgb), 0.16)"
          }}>
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
              </section>
              <section className="app-section-card" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            background: "rgba(var(--primary-rgb), 0.08)",
            border: "1px solid rgba(var(--primary-rgb), 0.16)"
          }}>
                {Array.from({
              length: 4
            }).map((_, i) => <div key={i} style={{
              background: "var(--surface)",
              borderRadius: "var(--control-radius)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
                    <SkeletonBlock width="50%" height="10px" />
                    <SkeletonBlock width="80%" height="22px" />
                    <SkeletonBlock width="40%" height="10px" />
                  </div>)}
              </section>
            </>}
          {!loading && account && <>
              <DevLayoutSection as="section" sectionKey="account-view-header" sectionType="content-card" parentKey="account-view-page-shell" className="app-section-card" style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "rgba(var(--primary-rgb), 0.08)",
            border: "1px solid rgba(var(--primary-rgb), 0.16)"
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap"
            }}>
                  <div>
                    <h1 style={{
                  margin: 0,
                  fontSize: "2rem",
                  color: "var(--text-primary)"
                }}>{account.billing_name || account.account_id}</h1>
                  </div>
                  <div style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }}>
                    <Button type="button" variant="secondary" onClick={handleTransactionsPage}>Transactions</Button>
                    <Button type="button" variant="secondary" onClick={handleInvoicesPage}>Invoices</Button>
                    {permissions.canEditAccount && <Button type="button" variant="secondary" onClick={handleEdit}>Edit</Button>}
                    {permissions.canFreezeAccount && <Button type="button" onClick={handleFreezeToggle}>{account.status === "Frozen" ? "Unfreeze" : "Freeze"}</Button>}
                  </div>
                </div>
                <div style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap"
            }}>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{
                cursor: "default"
              }}>ID: {account.account_id}</span>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{
                cursor: "default"
              }}>Customer: {account.customer_id || "—"}</span>
                  <span className="app-btn app-btn--secondary app-btn--sm" style={{
                cursor: "default"
              }}>Type: {account.account_type}</span>
                  <span className="app-btn app-btn--sm" style={{
                cursor: "default",
                ...(statusBadgeStyles[account.status] || {
                  background: "var(--surface)",
                  color: "var(--text-primary)"
                })
              }}>{account.status}</span>
                </div>
              </DevLayoutSection>
              <DevLayoutSection as="section" sectionKey="account-view-overview-card" sectionType="content-card" parentKey="account-view-page-shell" className="app-section-card" style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            background: "rgba(var(--primary-rgb), 0.08)",
            border: "1px solid rgba(var(--primary-rgb), 0.16)"
          }}>
                <DevLayoutSection sectionKey="account-view-metrics-grid" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px"
              }}>
                  {detailCard("Balance", currencyFormatter.format(Number(account.balance || 0)))}
                  {detailCard("Credit Limit", currencyFormatter.format(Number(account.credit_limit || 0)))}
                  {detailCard("Credit Terms", `${account.credit_terms || 0} days`)}
                  {detailCard("Created", account.created_at ? new Date(account.created_at).toLocaleDateString("en-GB") : "—")}
                </div>
                </DevLayoutSection>
                <DevLayoutSection sectionKey="account-view-billing-section" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                background: "var(--surface)",
                borderRadius: "var(--control-radius)",
                border: "1px solid rgba(var(--primary-rgb), 0.08)",
                padding: "16px"
              }}>
                  <h2 style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  fontSize: "1.2rem"
                }}>Billing Information</h2>
                  <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px"
                }}>
                    <div><p style={{
                      margin: 0,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: "0.75rem"
                    }}>Name</p><strong style={{
                      display: "block",
                      marginTop: "6px",
                      color: "var(--text-primary)"
                    }}>{account.billing_name || "—"}</strong></div>
                    <div><p style={{
                      margin: 0,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: "0.75rem"
                    }}>Email</p><strong style={{
                      display: "block",
                      marginTop: "6px",
                      color: "var(--text-primary)"
                    }}>{account.billing_email || "—"}</strong></div>
                    <div><p style={{
                      margin: 0,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: "0.75rem"
                    }}>Phone</p><strong style={{
                      display: "block",
                      marginTop: "6px",
                      color: "var(--text-primary)"
                    }}>{account.billing_phone || "—"}</strong></div>
                    <div><p style={{
                      margin: 0,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: "0.75rem"
                    }}>Address</p><strong style={{
                      display: "block",
                      marginTop: "6px",
                      color: "var(--text-primary)"
                    }}>{[account.billing_address_line1, account.billing_address_line2, account.billing_city, account.billing_postcode, account.billing_country].filter(Boolean).join(", ") || "—"}</strong></div>
                  </div>
                </div>
                </DevLayoutSection>
                <DevLayoutSection sectionKey="account-view-notes-section" sectionType="content-card" parentKey="account-view-overview-card">
                <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "var(--surface)",
                borderRadius: "var(--control-radius)",
                border: "1px solid rgba(var(--primary-rgb), 0.08)",
                padding: "16px"
              }}>
                  <h2 style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  fontSize: "1.2rem"
                }}>Internal Notes</h2>
                  <p style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6
                }}>{account.notes || "No notes recorded."}</p>
                </div>
                </DevLayoutSection>
              </DevLayoutSection>
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
          {!loading && !account && <p style={{
          color: "var(--danger)"
        }}>Account not found.</p>}
        </div>
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
