// file location: src/components/page-ui/company-accounts/company-accounts-ui.js
import { useIsVerticalPhone } from "@/hooks/useIsMobile";

export default function CompanyAccountsIndexPageUi(props) {
  // Portrait phone: 10px between the search/filter/action row and the
  // content beneath it.
  const isVerticalPhone = useIsVerticalPhone();
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
        {/* Company accounts page: tabs for company accounts and ledgers, a search and add toolbar, and the list, new-account form or ledger table beneath. */}
        <DevLayoutSection sectionKey="company-accounts-page-shell" sectionType="page-shell" shell>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: isVerticalPhone ? "var(--space-2)" : "20px"
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
              {/* Company list toolbar: search companies by name and, for permitted users, add a new account. */}
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
                  {/* Add new account button, shown only to users allowed to create accounts. */}
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
              {/* Back button shown above the new-account form, returning to the company list. */}
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
