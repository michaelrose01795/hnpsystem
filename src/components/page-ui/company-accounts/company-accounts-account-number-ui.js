// file location: src/components/page-ui/company-accounts/company-accounts-account-number-ui.js

export default function CompanyAccountDetailPageUi(props) {
  const {
    ACCOUNT_TABS,
    ALLOWED_ROLES,
    CompanyAccountForm,
    ConfirmationDialog,
    ProtectedRoute,
    account,
    activeTab,
    confirmDialog,
    error,
    fetchAccount,
    handleDelete,
    handleUpdate,
    loading,
    mode,
    permissions,
    renderTabContent,
    router,
    saving,
    setActiveTab,
    setConfirmDialog,
    setMode,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <>
        <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
          <button type="button" onClick={() => router.push("/company-accounts")} style={{
        alignSelf: "flex-start",
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        border: "none",
        background: "var(--surface)",
        color: "var(--text-1)",
        cursor: "pointer",
        transition: "all 0.15s ease"
      }} onMouseEnter={e => {
        e.currentTarget.style.background = "var(--surface)";
      }} onMouseLeave={e => {
        e.currentTarget.style.background = "var(--surface)";
      }}>
            ← All company accounts
          </button>
          {loading ? <p>Loading account…</p> : error ? <p style={{
        color: "var(--danger)"
      }}>{error}</p> : !account ? <p>Company account not found.</p> : mode === "edit" ? <CompanyAccountForm initialValues={account} isSubmitting={saving} onSubmit={async values => {
        await handleUpdate(values);
        fetchAccount();
      }} onCancel={() => setMode("view")} /> : <div style={{
        padding: "24px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
              {/* Header Section */}
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          flexWrap: "wrap"
        }}>
                <div>
                  <h1 style={{
              margin: 0,
              color: "var(--text-1)"
            }}>{account.company_name}</h1>
                  {account.trading_name && <p style={{
              margin: "4px 0 0 0",
              color: "var(--text-1)"
            }}>{account.trading_name}</p>}
                </div>
                <div style={{
            textAlign: "right"
          }}>
                  <p style={{
              margin: 0,
              fontWeight: 600,
              fontSize: "1.1rem",
              color: "var(--text-1)"
            }}>
                    #{account.account_number}
                  </p>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--surface)",
          paddingBottom: "8px",
          overflowX: "auto"
        }} className="tabs-scroll-container">
                {ACCOUNT_TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
              flex: "0 0 auto",
              borderRadius: "var(--radius-pill)",
              border: "1px solid transparent",
              padding: "10px 20px",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              background: isActive ? "var(--primary)" : "transparent",
              color: isActive ? "var(--text-2)" : "var(--text-1)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap"
            }} onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = "var(--surface)";
              }
            }} onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
              }
            }}>
                      {tab.label}
                    </button>;
          })}
              </div>

              {/* Tab Content */}
              <div style={{
          minHeight: "200px"
        }}>{renderTabContent()}</div>

              {/* Action Buttons */}
              <div style={{
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          paddingTop: "12px",
          borderTop: "1px solid var(--surface)"
        }}>
                {permissions.canEditAccount && <>
                    <button type="button" onClick={() => setMode("edit")} style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--surface)",
              color: "var(--text-1)",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.15s ease"
            }} onMouseEnter={e => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--primary)";
            }} onMouseLeave={e => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--surface)";
            }}>
                      Edit
                    </button>
                    <button type="button" onClick={handleDelete} disabled={saving} style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: saving ? "var(--surface)" : "var(--danger)",
              color: "var(--text-2)",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600,
              transition: "all 0.15s ease",
              opacity: saving ? 0.6 : 1
            }} onMouseEnter={e => {
              if (!saving) {
                e.currentTarget.style.background = "var(--danger-dark)";
              }
            }} onMouseLeave={e => {
              if (!saving) {
                e.currentTarget.style.background = "var(--danger)";
              }
            }}>
                      {saving ? "Deleting…" : "Delete"}
                    </button>
                  </>}
              </div>
            </div>}
        </div>
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Delete" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
