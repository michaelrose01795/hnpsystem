// file location: src/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TRANSACTION_TYPES, PAYMENT_METHODS } from "@/config/accounts";

export default function AccountTransactionsPageUi(props) {
  const {
    Button,
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

  // Filter controls live on the page toolbar, so the table card renders alone.
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({ ...filters, [name]: value });
  };
  const handleClearFilters = () => setFilters({ type: "", payment_method: "", from: "", to: "" });

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={TRANSACTION_ROLES}>
      <>
        {/* Named dev-overlay sections — page shell wraps a toolbar and the table. */}
        <DevLayoutSection
          sectionKey="account-transactions-page-shell"
          parentKey="app-layout-page-card"
          sectionType="page-shell"
          shell
          style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>

          {/* Toolbar — navigation, filters and actions on one wrapping row. */}
          <DevLayoutSection
            sectionKey="account-transactions-toolbar"
            parentKey="account-transactions-page-shell"
            sectionType="toolbar">
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--space-3)"
            }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/accounts/view/${accountId}`)}>
                Account
              </Button>
              <DropdownField
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                placeholder="All types"
                options={[{ label: "All Types", value: "", placeholder: true }, ...TRANSACTION_TYPES.map((option) => ({ label: option, value: option }))]}
                style={{ flex: "0 0 170px" }} />
              <DropdownField
                name="payment_method"
                value={filters.payment_method}
                onChange={handleFilterChange}
                placeholder="All methods"
                options={[{ label: "All Methods", value: "", placeholder: true }, ...PAYMENT_METHODS.map((method) => ({ label: method, value: method }))]}
                style={{ flex: "0 0 170px" }} />
              <div style={{ flex: "0 0 160px" }}>
                <CalendarField name="from" placeholder="From date" value={filters.from} onChange={handleFilterChange} size="sm" />
              </div>
              <div style={{ flex: "0 0 160px" }}>
                <CalendarField name="to" placeholder="To date" value={filters.to} onChange={handleFilterChange} size="sm" />
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginLeft: "auto" }}>
                <Button type="button" variant="secondary" size="sm" onClick={handleClearFilters}>Clear Filters</Button>
                {permissions.canExport && <Button type="button" size="sm" onClick={handleExport}>Export CSV</Button>}
              </div>
            </div>
          </DevLayoutSection>

          {/* Table card — --theme background (accentSurface), headerless. */}
          <DevLayoutSection
            sectionKey="account-transactions-table"
            parentKey="account-transactions-page-shell"
            sectionType="data-table">
            <TransactionTable
              transactions={transactions}
              loading={loading}
              filters={filters}
              onFilterChange={setFilters}
              pagination={pagination}
              onPageChange={handlePageChange}
              onExport={handleExport}
              accentSurface
              headerless />
          </DevLayoutSection>
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
