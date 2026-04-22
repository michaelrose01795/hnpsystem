// file location: src/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui.js

export default function AccountTransactionsPageUi(props) {
  const {
    Button,
    ControlGroup,
    PageSection,
    ProtectedRoute,
    TRANSACTION_ROLES,
    TransactionTable,
    accountId,
    filters,
    handleExport,
    handlePageChange,
    loading,
    pagination,
    permissions,
    router,
    setFilters,
    transactions,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={TRANSACTION_ROLES}>
      <>
        <PageSection>
          <div style={{
        display: "flex",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: "var(--space-3)"
      }}>
            <ControlGroup>
              <Button type="button" variant="secondary" onClick={() => router.push(`/accounts/view/${accountId}`)}>Account</Button>
              {permissions.canExport && <Button type="button" variant="ghost" onClick={handleExport}>Export</Button>}
            </ControlGroup>
          </div>
          <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} />
        </PageSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
