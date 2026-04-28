// file location: src/components/page-ui/customers/customers-customer-slug-ui.js

export default function CustomerDetailWorkspaceUi(props) {
  const {
    TAB_DEFINITIONS,
    TabGroup,
    ContactPreferenceToggle,
    PageSkeleton,
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
  } = props;

  switch (props.view) {
    case "section1":
      return (
        <main
          data-dev-section="1"
          data-dev-section-key="customer-profile-page-shell"
          data-dev-section-type="page-shell"
          style={{
            padding: "8px 0",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          {isLoading && PageSkeleton && (
            <PageSkeleton
              sections={[
                { rows: 2, minHeight: "160px" },
                { rows: 1, minHeight: "48px" },
                { rows: 4, minHeight: "260px" },
              ]}
            />
          )}

          {error && (
            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                border: "none",
                background: "var(--danger-surface)",
                color: "var(--danger-dark)",
              }}
            >
              {error}
            </div>
          )}

          {customer && !error && !isLoading && (
            <>
              <section
                data-dev-section="1"
                data-dev-section-key="customer-profile-summary"
                data-dev-section-type="section-shell"
                data-dev-background-token="customer-profile-summary"
                style={detailCardStyles.container}
              >
                <div style={detailCardStyles.identityBlock}>
                  <div style={detailCardStyles.nameGroup}>
                    <h1 style={detailCardStyles.name}>{customerName || customer.email || "Customer"}</h1>
                  </div>
                </div>

                <div style={detailGridStyles.grid}>
                  {profileGridItems.map((item) => (
                    <div
                      key={item.key}
                      data-dev-section="1"
                      data-dev-section-key={`customer-profile-card-${item.key}`}
                      data-dev-section-type="content-card"
                      data-dev-section-parent="customer-profile-summary"
                      data-dev-background-token="customer-profile-card"
                      style={detailGridStyles.item}
                    >
                      <span style={detailGridStyles.label}>{item.label}</span>

                      {item.type === "stats" ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(82px, 1fr))",
                            gap: "10px",
                            marginTop: "4px",
                          }}
                        >
                          {item.stats?.map((stat) => (
                            <div
                              key={stat.label}
                              style={{
                                borderRadius: "var(--radius-sm)",
                                background: "var(--layer-section-level-1)",
                                padding: "10px",
                              }}
                            >
                              <span
                                style={{
                                  display: "block",
                                  color: "var(--text-secondary)",
                                  fontSize: "0.68rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.12em",
                                }}
                              >
                                {stat.label}
                              </span>
                              <strong
                                style={{
                                  display: "block",
                                  marginTop: "4px",
                                  color: "var(--text-primary)",
                                  fontSize: "1.25rem",
                                }}
                              >
                                {stat.value}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : item.type === "list" ? (
                        item.items?.length ? (
                          <ul
                            style={{
                              listStyle: "none",
                              padding: 0,
                              margin: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {item.items.map((entry) => (
                              <li key={`${entry.label}-${entry.value}`}>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.2em",
                                  }}
                                >
                                  {entry.label}
                                </span>
                                <a href={`tel:${entry.value}`} style={{ color: "var(--primary)", fontWeight: 600 }}>
                                  {entry.value}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ color: "var(--text-secondary)" }}>No numbers on file</span>
                        )
                      ) : item.href ? (
                        <a href={item.href} style={{ color: "var(--primary)", fontWeight: 600, overflowWrap: "anywhere" }}>
                          {item.value || "—"}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)", overflowWrap: "anywhere" }}>
                          {item.value ?? "—"}
                        </span>
                      )}

                      {item.preference && ContactPreferenceToggle && (
                        <div style={{ marginTop: "8px" }}>
                          <ContactPreferenceToggle {...item.preference} />
                        </div>
                      )}
                      {item.preferences?.length && ContactPreferenceToggle && (
                        <div style={{ marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          {item.preferences.map((preference) => (
                            <ContactPreferenceToggle key={preference.label} {...preference} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <div
                data-dev-section="1"
                data-dev-section-key="customer-profile-tabs"
                data-dev-section-type="tab-row"
                style={{ display: "inline-flex", alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}
              >
                <TabGroup
                  items={TAB_DEFINITIONS.map((tab) => ({
                    label:
                      tab.id === "insights"
                        ? `${tab.label} (${vehicles.length})`
                        : tab.id === "history"
                        ? `${tab.label} (${jobs.length})`
                        : tab.label,
                    value: tab.id,
                  }))}
                  value={activeTab}
                  onChange={setActiveTab}
                  ariaLabel="Customer data tabs"
                />
              </div>

              <section
                data-dev-section="1"
                data-dev-section-key={`customer-profile-tab-${activeTab}`}
                data-dev-section-type="section-shell"
                data-dev-background-token="customer-profile-tab-panel"
                style={tabPanelStyles.container}
              >
                {renderTabContent()}
              </section>
            </>
          )}
        </main>
      );
    default:
      return null;
  }
}
