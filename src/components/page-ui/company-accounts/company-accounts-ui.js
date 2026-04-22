// file location: src/components/page-ui/company-accounts/company-accounts-ui.js

export default function CompanyAccountsIndexPageUi(props) {
  const {
    ALLOWED_ROLES,
    Button,
    CompanyAccountForm,
    DevLayoutSection,
    ProtectedRoute,
    SearchBar,
    accounts,
    activeTab,
    feedback,
    fetchAccounts,
    handleCreate,
    loading,
    permissions,
    renderLedgerTab,
    renderList,
    saving,
    search,
    setActiveTab,
    setSearch,
    setShowForm,
    showForm,
    tabs,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <>
        <DevLayoutSection sectionKey="company-accounts-page-shell" sectionType="page-shell" shell>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
          <DevLayoutSection sectionKey="company-accounts-page-header" sectionType="content-card" parentKey="company-accounts-page-shell">
            <div>
            <h1 style={{
              margin: 0
            }}>Company Accounts</h1>
            <p style={{
              margin: 0,
              color: "var(--text-secondary)"
            }}>Central directory of partner businesses linked to accounts.</p>
            </div>
          </DevLayoutSection>
          <DevLayoutSection sectionKey="company-accounts-tab-row" sectionType="tab-row" parentKey="company-accounts-page-shell">
            <div className="app-layout-tab-row" style={{
            display: "flex",
            gap: "6px",
            width: "100%",
            overflowX: "auto",
            flexShrink: 0,
            scrollbarWidth: "thin",
            scrollbarColor: "var(--scrollbar-thumb) transparent",
            scrollBehavior: "smooth",
            WebkitOverflowScrolling: "touch"
          }}>
            {tabs.map(tab => {
              const isActive = tab.id === activeTab;
              return <DevLayoutSection key={tab.id} as="button" sectionKey={`company-accounts-tab-${tab.id}`} sectionType="tab-chip" parentKey="company-accounts-tab-row" className={`app-btn ${isActive ? "app-btn--primary" : "app-btn--secondary"} app-btn--pill app-btn--sm`} type="button" onClick={() => setActiveTab(tab.id)} style={{
                flex: "0 0 auto",
                whiteSpace: "nowrap"
              }}>
                  {tab.label}
                </DevLayoutSection>;
            })}
            </div>
          </DevLayoutSection>
          {activeTab === "companies" ? <>
              {showForm && permissions.canCreateAccount && <DevLayoutSection sectionKey="company-accounts-form-back-link" sectionType="toolbar" parentKey="company-accounts-page-shell">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} style={{
              alignSelf: "flex-start"
            }}>
                    Back to company list
                  </Button>
                </DevLayoutSection>}
              {showForm ? <CompanyAccountForm parentSectionKey="company-accounts-page-shell" sectionKey="company-accounts-company-form" autoGenerateAccountNumber isSubmitting={saving} onSubmit={async values => {
            await handleCreate(values);
            fetchAccounts();
          }} onCancel={() => setShowForm(false)} /> : <>
                  <DevLayoutSection sectionKey="company-accounts-company-toolbar" sectionType="filter-row" parentKey="company-accounts-page-shell">
                    <div style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap"
              }}>
                      <SearchBar placeholder="Search companies A-Z" value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch("")} style={{
                  flex: "1 1 260px"
                }} />
                      {permissions.canCreateAccount && <DevLayoutSection sectionKey="company-accounts-add-account-button" sectionType="floating-action" parentKey="company-accounts-company-toolbar">
                          <Button type="button" variant="primary" pill onClick={() => setShowForm(true)} style={{
                    flex: "0 0 auto"
                  }}>
                            Add new account
                          </Button>
                        </DevLayoutSection>}
                    </div>
                  </DevLayoutSection>
                  {feedback && !accounts.length && !loading && <p style={{
              margin: 0,
              color: "var(--text-secondary)"
            }}>{feedback}</p>}
                  {renderList()}
                </>}
            </> : renderLedgerTab()}
          </div>
        </DevLayoutSection>
        <style jsx>{`
          .company-accounts-row:hover,
          .company-accounts-row:focus-visible {
            background: rgba(var(--primary-rgb), 0.1) !important;
            box-shadow: inset 0 0 0 1px rgba(var(--primary-rgb), 0.16);
            outline: none;
          }

          .company-accounts-meta-pill {
            pointer-events: none;
            max-width: 100%;
            color: var(--primary);
            background: var(--control-bg);
          }

          .company-accounts-account-pill {
            font-weight: 700;
          }

          @media (max-width: 900px) {
            .company-accounts-row {
              align-items: flex-start !important;
            }
          }
        `}</style>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
