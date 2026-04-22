// file location: src/components/page-ui/customers/customers-customer-slug-ui.js

export default function CustomerDetailWorkspaceUi(props) {
  const {
    TAB_DEFINITIONS,
    TabGroup,
    activeTab,
    customer,
    customerName,
    detailCardStyles,
    detailGridStyles,
    error,
    isLoading,
    jobs,
    profileGridItems,
    renderTabContent,
    setActiveTab,
    tabPanelStyles,
    vehicles,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <main style={{
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  }}>
        {isLoading && <div style={{
      borderRadius: "var(--radius-md)",
      padding: "18px",
      textAlign: "center",
      border: "none",
      background: "var(--surface)"
    }}>
            Loading customer…
          </div>}

        {error && <div style={{
      borderRadius: "var(--radius-md)",
      padding: "16px",
      border: "1px solid rgba(var(--danger-rgb), 0.35)",
      background: "var(--danger-surface)",
      color: "var(--danger-dark)"
    }}>
            {error}
          </div>}

        {customer && !error && <>
            <section style={detailCardStyles.container}>
              <div style={detailCardStyles.identityBlock}>
                <div style={detailCardStyles.nameGroup}>
                  <p style={{
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "var(--grey-accent)",
              margin: 0
            }}>
                    Customer profile
                  </p>
                  <h1 style={detailCardStyles.name}>{customerName || customer.email || "Customer"}</h1>
                </div>
              </div>

              <div style={detailGridStyles.grid}>
                {profileGridItems.map(item => <div key={item.key} style={detailGridStyles.item}>
                    <span style={detailGridStyles.label}>{item.label}</span>
                    {item.type === "list" ? item.items?.length ? <ul style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
                          {item.items.map(entry => <li key={`${entry.label}-${entry.value}`}>
                              <span style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em"
                }}>
                                {entry.label}
                              </span>
                              <a href={`tel:${entry.value}`} style={{
                  color: "var(--primary)",
                  fontWeight: 600
                }}>
                                {entry.value}
                              </a>
                            </li>)}
                        </ul> : <span style={{
              color: "var(--text-secondary)"
            }}>No numbers on file</span> : item.href ? <a href={item.href} style={{
              color: "var(--primary)",
              fontWeight: 600
            }}>
                        {item.value || "—"}
                      </a> : <span style={{
              fontWeight: 600,
              color: "var(--text-primary)"
            }}>
                        {item.value ?? "—"}
                      </span>}
                  </div>)}
              </div>
            </section>

            <TabGroup items={TAB_DEFINITIONS.map(tab => ({
        label: tab.id === "vehicles" ? `${tab.label} (${vehicles.length})` : tab.id === "history" ? `${tab.label} (${jobs.length})` : tab.label,
        value: tab.id
      }))} value={activeTab} onChange={setActiveTab} ariaLabel="Customer data tabs" />

            <section style={tabPanelStyles.container}>{renderTabContent()}</section>
          </>}
      </main>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
