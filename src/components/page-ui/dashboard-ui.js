// file location: src/components/page-ui/dashboard-ui.js

export default function DashboardUi(props) {
  const {
    AfterSalesManagerDashboard,
    ContentWidth,
    DevLayoutSection,
    PageShell,
    PageSkeleton,
    RetailManagersDashboard,
    SearchBar,
    SectionShell,
    ServiceManagerDashboard,
    WorkshopManagerDashboard,
    handleSearch,
    jobs,
    popupCardStyles,
    popupOverlayStyles,
    searchResults,
    searchTerm,
    setSearchTerm,
    setShowSearch,
    showSearch,
    user,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return null; // render empty page state.

    case "section2":
      return <PageSkeleton />; // render extracted page section.

    case "section3":
      return <>
        <WorkshopManagerDashboard />
      </>; // render extracted page section.

    case "section4":
      return <>
        <ServiceManagerDashboard />
      </>; // render extracted page section.

    case "section5":
      return <>
        <AfterSalesManagerDashboard />
      </>; // render extracted page section.

    case "section6":
      return <>
        <RetailManagersDashboard user={user} /> {/* show retail dashboard */}
      </>; // render extracted page section.

    case "section7":
      return <>
      <PageShell sectionKey="dashboard-fallback-shell">
        <ContentWidth sectionKey="dashboard-fallback-content" parentKey="dashboard-fallback-shell" widthMode="content">
        <div> {/* outer container for dashboard */}
        <div className="app-section-card" data-dev-section="1" data-dev-section-key="dashboard-fallback-toolbar" data-dev-section-type="toolbar" data-dev-section-parent="dashboard-fallback-content" style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "12px 20px"
        }}>
          <button onClick={() => setShowSearch(true)} style={{
            padding: "10px 16px",
            backgroundColor: "var(--primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-xs)",
            fontSize: "0.9rem",
            fontWeight: "600",
            cursor: "pointer"
          }}>
            Search
          </button>
        </div>

        <div data-dev-section="1" data-dev-section-key="dashboard-fallback-table-shell" data-dev-section-type="section-shell" data-dev-section-parent="dashboard-fallback-content" data-dev-shell="1" style={{
          backgroundColor: "var(--danger-surface)",
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-xs)",
          minHeight: "70vh"
        }}>
          <p>Welcome {user?.username || "Guest"}! Here’s your current jobs overview.</p>

          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px"
          }}>
            <thead>
              <tr style={{
                backgroundColor: "var(--danger)"
              }}>
                <th style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>Job Number</th>
                <th style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>Customer</th>
                <th style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>Vehicle</th>
                <th style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>Status</th>
                <th style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>Technician</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => <tr key={job.id}>
                  <td style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>{job.jobNumber}</td>
                  <td style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>{job.customer}</td>
                  <td style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>
                    {job.make} {job.model} ({job.reg})
                  </td>
                  <td style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>{job.status}</td>
                  <td style={{
                  padding: "8px",
                  border: "1px solid var(--primary-light)"
                }}>{job.technician}</td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      </ContentWidth>
      </PageShell>

      {showSearch && <DevLayoutSection sectionKey="dashboard-fallback-search-modal" sectionType="floating-action" style={{
    ...popupOverlayStyles,
    zIndex: 1300
  }}>
          <SectionShell sectionKey="dashboard-fallback-search-modal-card" parentKey="dashboard-fallback-search-modal" style={{
      ...popupCardStyles,
      padding: "30px",
      width: "min(420px, 90%)",
      backgroundColor: "var(--search-surface)",
      border: "1px solid var(--search-surface-muted)",
      color: "var(--search-text)"
    }}>
            <h2 style={{
        marginBottom: "16px",
        color: "var(--primary)"
      }}>Search Jobs</h2>
            <SearchBar value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClear={() => setSearchTerm("")} placeholder="Search by job number, reg, or customer" style={{
        width: "100%",
        marginBottom: "12px"
      }} />
            <button onClick={handleSearch} style={{
        width: "100%",
        padding: "10px",
        backgroundColor: "var(--primary)",
        color: "white",
        border: "none",
        borderRadius: "var(--radius-xs)",
        marginBottom: "12px",
        cursor: "pointer",
        fontWeight: 600
      }}>
              Search
            </button>
            <button onClick={() => setShowSearch(false)} style={{
        width: "100%",
        padding: "10px",
        backgroundColor: "var(--info-surface)",
        color: "var(--text-secondary)",
        border: "none",
        borderRadius: "var(--radius-xs)",
        cursor: "pointer"
      }}>
              Close
            </button>

            <div style={{
        marginTop: "20px",
        maxHeight: "200px",
        overflowY: "auto"
      }}>
              {searchResults.length === 0 ? <p style={{
          color: "var(--grey-accent)"
        }}>No results found.</p> : <ul style={{
          listStyle: "none",
          padding: 0
        }}>
                  {searchResults.map(job => <li key={job.id} style={{
            padding: "10px",
            borderBottom: "1px solid var(--surface-light)"
          }}>
                      <strong>{job.jobNumber}</strong> - {job.customer} ({job.reg})
                    </li>)}
                </ul>}
            </div>
          </SectionShell>
        </DevLayoutSection>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
