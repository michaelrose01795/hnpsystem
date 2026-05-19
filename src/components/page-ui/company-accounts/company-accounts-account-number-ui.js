// file location: src/components/page-ui/company-accounts/company-accounts-account-number-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup"; // canonical staffglobal .tab-api tab system
import Button from "@/components/ui/Button"; // canonical .app-btn button family

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
        {/* Page shell — transparent; named so the dev overlay shows a clean hierarchy. */}
        <DevLayoutSection
          sectionKey="company-account-detail-shell"
          parentKey="app-layout-page-card"
          sectionType="page-shell"
          shell
          backgroundToken="transparent"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Combined top row — back link, identity, and Edit/Delete actions all
              share one wrapping flex row above the tab card. */}
          <DevLayoutSection
            sectionKey="company-account-detail-toolbar"
            parentKey="company-account-detail-shell"
            sectionType="toolbar">
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => router.push("/company-accounts")}
                style={{ flexShrink: 0 }}>
                All company accounts
              </Button>

              {account && mode !== "edit" &&
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  minWidth: 0
                }}>
                  <h1 style={{
                    margin: 0,
                    color: "var(--text-1)",
                    fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)"
                  }}>
                    {account.company_name}
                  </h1>
                  {account.trading_name &&
                    <span style={{ color: "var(--surfaceTextMuted)" }}>{account.trading_name}</span>}
                  <span className="app-badge app-badge--accent-soft app-badge--control">
                    #{account.account_number}
                  </span>
                </div>
              }

              {account && mode !== "edit" && permissions.canEditAccount &&
                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginLeft: "auto"
                }}>
                  <Button type="button" variant="secondary" onClick={() => setMode("edit")}>
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
                    {saving ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              }
            </div>
          </DevLayoutSection>

          {/* Body */}
          {loading ?
            <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>Loading account…</p> :
          error ?
            <p className="app-status-message app-status-message--danger" style={{ margin: 0 }}>{error}</p> :
          !account ?
            <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>Company account not found.</p> :
          mode === "edit" ?
            <CompanyAccountForm
              initialValues={account}
              isSubmitting={saving}
              onSubmit={async (values) => { await handleUpdate(values); fetchAccount(); }}
              onCancel={() => setMode("view")} /> :

            <LayerSurface
              as="div"
              sectionKey="company-account-detail-card"
              parentKey="company-account-detail-shell"
              sectionType="page-card"
              padding="var(--page-card-padding)"
              gap="20px">

              {/* Tabs — staffglobal .tab-api; tab-api--inline shrinks the
                  background strip to the tabs' content width instead of
                  spanning the full row. */}
              <TabGroup
                items={ACCOUNT_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
                value={activeTab}
                onChange={setActiveTab}
                ariaLabel="Company account sections"
                className="tab-api--inline"
                devSectionKey="company-account-detail-tabs"
                devSectionParent="company-account-detail-card" />

              {/* Tab content */}
              <div style={{ minHeight: "200px" }}>{renderTabContent()}</div>
            </LayerSurface>}
        </DevLayoutSection>
        <ConfirmationDialog
          isOpen={!!confirmDialog}
          message={confirmDialog?.message}
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={() => setConfirmDialog(null)}
          onConfirm={confirmDialog?.onConfirm} />
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
