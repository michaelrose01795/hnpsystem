// file location: src/components/page-ui/job-cards/archive/job-cards-archive-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

export default function ArchivedJobsPageUi(props) {
  const {
    Button,
    DevLayoutSection,
    DropdownField,
    Link,
    STATUS_BADGE_CLASSES,
    SearchBar,
    availableStatuses,
    defaultStatusBadgeClass,
    error,
    filteredResults,
    isSearching,
    prefetchJob,
    query,
    regOnly,
    runSearch,
    setQuery,
    setRegOnly,
    setSortOrder,
    setStatusFilter,
    sortOrder,
    statusFilter,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <LayerSurface sectionKey="job-cards-archive-page-shell" sectionType="page-shell" shell className="app-page-stack" gap="24px" padding={0}>
        <DevLayoutSection as="form" data-presentation="archive-filters" sectionKey="job-cards-archive-search-toolbar" parentKey="job-cards-archive-page-shell" sectionType="toolbar" backgroundToken="transparent" onSubmit={event => {
      event.preventDefault();
      runSearch(query);
    }} className="app-toolbar-row" style={{
      display: "flex",
      width: "100%",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
      padding: 0,
      boxShadow: "none",
      color: "var(--search-text)"
    }}>
          <DevLayoutSection sectionKey="job-cards-archive-search-input" parentKey="job-cards-archive-search-toolbar" sectionType="filter-row" backgroundToken="search-surface" style={{
        flex: "1 1 260px"
      }}>
            <SearchBar value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search by reg, job number, or customer name" style={{
          flex: "1 1 260px"
        }} />
          </DevLayoutSection>
          <DevLayoutSection sectionKey="job-cards-archive-toolbar-actions" parentKey="job-cards-archive-search-toolbar" sectionType="toolbar" backgroundToken="accent-surface" style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px"
      }}>
            <DropdownField aria-label="Filter archive results by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} options={availableStatuses.map(status => ({
          value: status,
          label: status === "all" ? "All statuses" : status
        }))} placeholder="All statuses" style={{
          minWidth: "150px",
          width: "auto"
        }} />

            <DropdownField aria-label="Sort archive results" value={sortOrder} onChange={event => setSortOrder(event.target.value)} options={[{
          value: "updated-desc",
          label: "Newest completed"
        }, {
          value: "updated-asc",
          label: "Oldest completed"
        }, {
          value: "job-asc",
          label: "Job number A-Z"
        }, {
          value: "job-desc",
          label: "Job number Z-A"
        }, {
          value: "customer-asc",
          label: "Customer A-Z"
        }]} placeholder="Sort archive" style={{
          minWidth: "180px",
          width: "auto"
        }} />

            <Button type="submit" variant="primary" disabled={isSearching} style={{
          minWidth: "120px",
          opacity: isSearching ? 0.6 : 1
        }}>
              {isSearching ? "Searching…" : "Search"}
            </Button>

            <Button type="button" variant={regOnly ? "primary" : "secondary"} onClick={() => {
          setRegOnly(current => !current);
        }} aria-pressed={regOnly}>
              Registration Only
            </Button>

            <Button type="button" variant="secondary" onClick={() => {
          setQuery("");
          setStatusFilter("all");
          setSortOrder("updated-desc");
          setRegOnly(false);
          runSearch("");
        }}>
              Clear filtes
            </Button>
          </DevLayoutSection>
        </DevLayoutSection>

        {error && <LayerTheme sectionKey="job-cards-archive-error-banner" parentKey="job-cards-archive-page-shell" sectionType="state-banner" backgroundToken="danger-surface" radius="var(--radius-sm)" padding="12px">
            <p style={{
        margin: 0,
        color: "var(--danger)"
      }}>{error}</p>
          </LayerTheme>}

        <LayerTheme
          as="section"
          data-presentation="archive-results"
          sectionKey="job-cards-archive-results-panel"
          parentKey="job-cards-archive-page-shell"
          sectionType="content-card"
          shell>
          <LayerSurface
            data-app-table-shell-scroll
            sectionKey="job-cards-archive-results-scroll"
            parentKey="job-cards-archive-results-panel"
            sectionType="data-table-shell"
            padding={0}
            gap={0}
            className="app-table-shell-scroll"
            role="region"
            aria-label="Archived job results"
            tabIndex={0}>
          <DevLayoutSection as="table" sectionKey="job-cards-archive-results-table" parentKey="job-cards-archive-results-scroll" sectionType="data-table" backgroundToken="surface" className="app-data-table app-table-shell app-table-shell--with-headings">
              <thead data-dev-section="1" data-dev-section-key="job-cards-archive-results-table-headings" data-dev-section-type="table-headings" data-dev-section-parent="job-cards-archive-results-table">
                <tr>
                  <th>Job #</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody data-dev-section-key="job-cards-archive-results-table-rows">
                {filteredResults.map(job => {
              const badgeClass = STATUS_BADGE_CLASSES[job.status] || defaultStatusBadgeClass;
              return <tr key={job.id} data-dev-section-key={`job-cards-archive-results-row-${job.id}`}>
                      <td style={{
                  fontWeight: 600
                }}>{job.jobNumber}</td>
                      <td>{job.customer || "—"}</td>
                      <td>
                        <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}>
                          <span style={{
                      fontWeight: 600
                    }}>{job.vehicleMakeModel || "—"}</span>
                          <span>{job.vehicleReg || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`app-badge ${badgeClass}`}>
                          {job.status}
                        </span>
                      </td>
                      <td>
                        {job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <Link href={`/job-cards/${encodeURIComponent(job.jobNumber)}?archive=1`} onMouseEnter={() => prefetchJob(job.jobNumber)} // warm SWR cache on hover
                  className="app-table-action-btn">
                          View archive
                        </Link>
                      </td>
                    </tr>;
            })}
                {filteredResults.length === 0 && <tr data-dev-section-key="job-cards-archive-empty-row">
                    <td colSpan={6} style={{
                textAlign: "center"
              }}>
                      No archived jobs matched the current filters.
                    </td>
                  </tr>}
              </tbody>
          </DevLayoutSection>
          </LayerSurface>
        </LayerTheme>
      </LayerSurface>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
