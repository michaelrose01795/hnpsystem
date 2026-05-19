// file location: src/components/page-ui/accounts/accounts-ui.js

export default function AccountsListPageUi(props) {
  const {
    ALLOWED_ROLES,
    AccountTable,
    AccountUpsertModal,
    AccountsSettingsModal,
    Button,
    DevLayoutSection,
    ProtectedRoute,
    ToolbarRow,
    accounts,
    canCreateAccount,
    canExport,
    closeAccountModal,
    closeSettingsModal,
    fetchAccounts,
    handleAccountSelect,
    handleExport,
    handlePageChange,
    handleSortChange,
    isAccountModalOpen,
    isSettingsModalOpen,
    loading,
    modalAccountId,
    modalMode,
    openCreateModal,
    openSettingsModal,
    pagination,
    renderFilters,
    renderLinkedFinance,
    sortState,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <>
        <DevLayoutSection sectionKey="accounts-page-shell" sectionType="page-shell" shell>
        <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
          <ToolbarRow style={{
          justifyContent: "flex-end"
        }}>
            <Button type="button" variant="secondary" size="sm" onClick={openSettingsModal}>
              Accounts Settings
            </Button>
            {canExport &&
            <Button type="button" variant="secondary" size="sm" onClick={handleExport}>
                Export
              </Button>}
            {canCreateAccount &&
            <Button type="button" size="sm" onClick={openCreateModal}>
                New Account
              </Button>}
          </ToolbarRow>
          {renderLinkedFinance()}
          <DevLayoutSection sectionKey="accounts-ledger-table" sectionType="data-table" parentKey="accounts-page-shell">
            <AccountTable toolbar={renderFilters()} accounts={accounts} loading={loading} pagination={pagination} onPageChange={handlePageChange} sortState={sortState} onSortChange={handleSortChange} onSelectAccount={handleAccountSelect} />
          </DevLayoutSection>
        </div>
        <AccountUpsertModal isOpen={isAccountModalOpen} mode={modalMode} accountId={modalAccountId} onClose={closeAccountModal} onSaved={fetchAccounts} />
        <AccountsSettingsModal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} />
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
