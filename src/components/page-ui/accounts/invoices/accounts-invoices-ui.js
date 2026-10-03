// file location: src/components/page-ui/accounts/invoices/accounts-invoices-ui.js
import { useIsVerticalPhone } from "@/hooks/useIsMobile";

export default function InvoicesPageUi(props) {
  // Portrait phone: 10px between the search/filter/action row and the
  // content beneath it.
  const isVerticalPhone = useIsVerticalPhone();
  const {
    Button,
    DevLayoutSection,
    INVOICE_ROLES,
    InvoiceTable,
    InvoiceTableToolbar,
    ProtectedRoute,
    filters,
    handleExport,
    handlePageChange,
    invoices,
    loading,
    pagination,
    router,
    setFilters,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={INVOICE_ROLES}>
      <>
        {/* Invoices page: filter and export controls above the full invoice table. */}
        <DevLayoutSection sectionKey="accounts-invoices-page-shell" sectionType="page-shell" shell>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: isVerticalPhone ? "var(--space-2)" : "20px"
      }}>
            {/* Actions bar: invoice filters and search, with the export and other page buttons. */}
            <DevLayoutSection as="div" data-presentation="invoices-actions" sectionKey="accounts-invoices-header-actions" sectionType="toolbar" parentKey="accounts-invoices-page-shell" style={{
          display: "flex",
          gap: "var(--button-gap)",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
              <InvoiceTableToolbar filters={filters} onFilterChange={setFilters} onExport={handleExport} />
              <Button type="button" variant="secondary" onClick={handleExport}>
                Export
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/accounts")} style={{
            background: "rgba(var(--primary-rgb), 0.12)",
            color: "var(--primary-selected)"
          }}>
                Accounts
              </Button>
            </DevLayoutSection>
            {/* Invoice table: every invoice matching the filters, with paging. */}
            <DevLayoutSection data-presentation="invoices-table" sectionKey="accounts-invoices-table" sectionType="data-table" parentKey="accounts-invoices-page-shell">
              <InvoiceTable invoices={invoices} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} loading={loading} accentSurface showHeader={false} />
            </DevLayoutSection>
          </div>
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
