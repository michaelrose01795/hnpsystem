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
          </ToolbarRow>
          {renderLinkedFinance()}
          {renderFilters()}
          <DevLayoutSection sectionKey="accounts-ledger-table" sectionType="data-table" parentKey="accounts-page-shell">
            <AccountTable accounts={accounts} loading={loading} pagination={pagination} onPageChange={handlePageChange} sortState={sortState} onSortChange={handleSortChange} onSelectAccount={handleAccountSelect} canExport={canExport} canCreateAccount={canCreateAccount} onExport={handleExport} onCreateAccount={openCreateModal} />
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
