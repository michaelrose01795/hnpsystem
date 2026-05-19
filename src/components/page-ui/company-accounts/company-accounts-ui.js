// file location: src/components/page-ui/company-accounts/company-accounts-ui.js

export default function CompanyAccountsIndexPageUi(props) {
  const {
    ALLOWED_ROLES,
    Button,
    CompanyAccountForm,
    DevLayoutSection,
    ProtectedRoute,
    SearchBar,
    TabGroup,
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
          <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap"
            }}>
              <TabGroup
                items={tabs.map(tab => ({ value: tab.id, label: tab.label }))}
                value={activeTab}
                onChange={setActiveTab}
                ariaLabel="Company accounts views"
                devSectionKey="company-accounts-tab-row"
                devSectionParent="company-accounts-page-shell" />
              {activeTab === "companies" && !showForm && <DevLayoutSection sectionKey="company-accounts-company-toolbar" sectionType="filter-row" parentKey="company-accounts-page-shell" style={{
                flex: "1 1 420px",
                minWidth: 0
              }}>
                <div style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexWrap: "wrap"
                }}>
                  <SearchBar placeholder="Search companies A-Z" value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch("")} style={{
                    flex: "1 1 260px",
                    minWidth: "220px"
                  }} />
                  {permissions.canCreateAccount && <DevLayoutSection sectionKey="company-accounts-add-account-button" sectionType="floating-action" parentKey="company-accounts-company-toolbar">
                      <Button type="button" variant="primary" onClick={() => setShowForm(true)} style={{
                        flex: "0 0 auto"
                      }}>
                        Add new account
                      </Button>
                    </DevLayoutSection>}
                </div>
              </DevLayoutSection>}
            </div>
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
                  {feedback && !accounts.length && !loading && <p className="app-status-message app-status-message--info" style={{
              margin: 0
            }}>{feedback}</p>}
                  {renderList()}
                </>}
            </> : renderLedgerTab()}
          </div>
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
