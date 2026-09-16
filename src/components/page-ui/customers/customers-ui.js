// file location: src/components/page-ui/customers/customers-ui.js
//
// Presentation layer for the staff customer list (/customers). All data and
// state live in src/pages/customers/index.js — this file only renders.
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import StatusMessage from "@/components/ui/StatusMessage";
import Button from "@/components/ui/Button";

const dash = (value) => (value ? value : "—");
const countLabel = (value) => (typeof value === "number" ? String(value) : "—");

// Summary tiles sit in a nowrap row (see the strip below). The centring
// overrides the space-between that .app-summary-item defaults to, so label and
// value read as one centred pair inside the fixed 44px tile.
const SUMMARY_TILE_STYLE = {
  flex: "1 0 8.5rem",
  minWidth: 0,
  justifyContent: "center",
  textAlign: "center",
};

export default function CustomersIndexUi(props) {
  const {
    DevLayoutSection,
    DropdownField,
    PageShell,
    PageSkeleton,
    SearchBar,
    SectionShell,
    errorMessage,
    goToCustomer,
    goToNextPage,
    goToPreviousPage,
    handleClearSearch,
    handleSearchChange,
    handleSortChange,
    hasNextPage,
    hasPreviousPage,
    loading,
    pageCount,
    pageNumber,
    rangeEnd,
    rangeStart,
    rows,
    searchInput,
    searchTerm,
    sort,
    sortOptions,
    totalCount,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <PageSkeleton />; // first load, before any customers have arrived.

    case "section2":
      return (
        <PageShell sectionKey="customers-list-shell">
          <div className="app-page-stack">
            <SectionShell
              sectionKey="customers-list-filter-shell"
              parentKey="customers-list-shell"
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0,
                }}
              >
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <SearchBar
                    data-presentation="customers-search"
                    placeholder="Search name, email, phone or postcode"
                    value={searchInput}
                    onChange={handleSearchChange}
                    onClear={handleClearSearch}
                  />
                </div>
                <div style={{ flex: "0 1 220px", minWidth: 0 }}>
                  <DropdownField
                    value={sort}
                    options={sortOptions}
                    size="sm"
                    onValueChange={handleSortChange}
                  />
                </div>
              </div>

              {/* Summary strip. Sits inside the filter shell, directly below
                  the search + sort row, so search, sort and counts read as one
                  control block. The shell is a --theme layer, so the tiles stay
                  LayerSurface and the alternation holds. Tiles are a fixed 44px
                  (.app-summary-item) and lay out nowrap with a horizontal
                  scroll — as on /jobs — so a narrow screen scrolls the tiles
                  rather than wrapping them. */}
              <DevLayoutSection
                sectionKey="customers-list-summary"
                parentKey="customers-list-filter-shell"
                sectionType="content-card"
                className="app-summary-section"
                style={{ minWidth: 0 }}
              >
                <div
                  className="app-summary-grid"
                  role="list"
                  aria-label="Customer list summary"
                  style={{
                    display: "flex",
                    flexFlow: "row nowrap",
                    gap: "10px",
                    width: "100%",
                    minWidth: 0,
                    overflowX: "auto",
                    overflowY: "hidden",
                  }}
                >
                  <LayerSurface
                    as="div"
                    className="app-summary-item"
                    radius="var(--radius-sm)"
                    role="listitem"
                    style={SUMMARY_TILE_STYLE}
                  >
                    <span className="app-summary-label">
                      {searchTerm ? "Matches" : "Total customers"}
                    </span>
                    <strong className="app-summary-value">{totalCount}</strong>
                  </LayerSurface>
                  <LayerSurface
                    as="div"
                    className="app-summary-item"
                    radius="var(--radius-sm)"
                    role="listitem"
                    style={SUMMARY_TILE_STYLE}
                  >
                    <span className="app-summary-label">Showing</span>
                    <strong className="app-summary-value">
                      {totalCount === 0 ? "0" : `${rangeStart}–${rangeEnd}`}
                    </strong>
                  </LayerSurface>
                  <LayerSurface
                    as="div"
                    className="app-summary-item"
                    radius="var(--radius-sm)"
                    role="listitem"
                    style={SUMMARY_TILE_STYLE}
                  >
                    <span className="app-summary-label">Page</span>
                    <strong className="app-summary-value">
                      {pageNumber} of {pageCount}
                    </strong>
                  </LayerSurface>
                </div>
              </DevLayoutSection>
            </SectionShell>

            <SectionShell
              sectionKey="customers-list-table-shell"
              parentKey="customers-list-shell"
              style={{ minWidth: 0 }}
            >
              {errorMessage ? (
                <StatusMessage tone="danger">{errorMessage}</StatusMessage>
              ) : null}

              {rows.length === 0 && !loading ? (
                <EmptyState
                  variant="bare"
                  role="status"
                  icon="🔍"
                  title={
                    searchTerm
                      ? `No customers match "${searchTerm}"`
                      : "No customers yet"
                  }
                  description={
                    searchTerm
                      ? "Try a different name, email address, phone number or postcode."
                      : "Customers appear here once they are added to the database."
                  }
                />
              ) : (
                <DevLayoutSection
                  sectionKey="customers-list-table-viewport"
                  parentKey="customers-list-table-shell"
                  sectionType="scroll-region"
                  style={{ overflowX: "auto", minWidth: 0 }}
                  aria-busy={loading ? "true" : "false"}
                >
                  <table className="app-data-table app-data-table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Customer</th>
                        <th scope="col">Email</th>
                        <th scope="col">Phone</th>
                        <th scope="col">Postcode</th>
                        <th scope="col">Vehicles</th>
                        <th scope="col">Jobs</th>
                        <th scope="col">Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          style={{ cursor: row.href ? "pointer" : "default" }}
                          onClick={() => goToCustomer(row.href)}
                        >
                          <td>
                            {row.href ? (
                              // The anchor keeps the row reachable by keyboard
                              // and screen reader; the row click is a shortcut.
                              <Link
                                href={row.href}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {row.displayName}
                              </Link>
                            ) : (
                              row.displayName
                            )}
                          </td>
                          <td>{dash(row.email)}</td>
                          <td>{dash(row.mobile)}</td>
                          <td>{dash(row.postcode)}</td>
                          <td>{countLabel(row.vehicleCount)}</td>
                          <td>{countLabel(row.jobCount)}</td>
                          <td>{row.addedLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DevLayoutSection>
              )}

              {pageCount > 1 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "8px",
                    marginTop: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={!hasPreviousPage || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={!hasNextPage || loading}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </SectionShell>
          </div>
        </PageShell>
      );

    default:
      return null; // keep unknown sections visually empty.
  }
}
