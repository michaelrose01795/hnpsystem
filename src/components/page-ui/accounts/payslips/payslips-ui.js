// file location: src/components/page-ui/accounts/payslips/payslips-ui.js
// Presentation layer for the account-manager payslips workspace. Mirrors the
// /accounts/index.js → accounts-ui.js split so all rendering lives outside the
// page logic file.

import {
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  formatStatusLabel,
  getStatusTone,
} from "@/features/payslips/payslipUtils";

export default function PayslipsAdminPageUi(uiProps) {
  const {
    ALLOWED_ROLES,
    Button,
    CalendarField,
    DevLayoutSection,
    DropdownField,
    PayslipDetailPopup,
    PayslipUpsertModal,
    ProtectedRoute,
    SearchBar,
    STATUS_OPTIONS,
    ToolbarRow,
    activePayslip,
    departmentOptions,
    editingPayslip,
    error,
    filters,
    handleDelete,
    handleFilterChange,
    handleResetFilters,
    fetchPayslips,
    isCreateOpen,
    loading,
    payslips,
    setActivePayslip,
    setEditingPayslip,
    setIsCreateOpen,
    userOptions,
    users,
  } = uiProps;

  if (uiProps.view !== "section1") return null;

  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <DevLayoutSection sectionKey="payslips-page-shell" sectionType="page-shell" shell>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ToolbarRow>
            <div style={{ display: "grid", gap: "4px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                Accounts
              </span>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--accentText, var(--accent))" }}>
                Payslips
              </h1>
            </div>
          </ToolbarRow>

          {/* Filters */}
          <DevLayoutSection
            as="section"
            sectionKey="payslips-filter-panel"
            sectionType="content-card"
            parentKey="payslips-page-shell"
            className="app-section-card"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <DevLayoutSection sectionKey="payslips-filter-toolbar" sectionType="filter-row" parentKey="payslips-filter-panel">
              <ToolbarRow>
                <SearchBar
                  name="search"
                  placeholder="Search reference, period or notes"
                  value={filters.search}
                  onChange={(event) => handleFilterChange("search", event.target.value)}
                  onClear={() => handleFilterChange("search", "")}
                  style={{ flex: "1 1 240px", background: "var(--surface)" }}
                />
                <DropdownField
                  name="userId"
                  value={filters.userId}
                  onChange={(event) => handleFilterChange("userId", event.target.value)}
                  options={userOptions}
                  style={{ flex: "0 0 220px", background: "var(--surface)" }}
                />
                <DropdownField
                  name="department"
                  value={filters.department}
                  onChange={(event) => handleFilterChange("department", event.target.value)}
                  options={departmentOptions}
                  style={{ flex: "0 0 200px", background: "var(--surface)" }}
                />
                <DropdownField
                  name="status"
                  value={filters.status}
                  onChange={(event) => handleFilterChange("status", event.target.value)}
                  options={STATUS_OPTIONS}
                  style={{ flex: "0 0 160px", background: "var(--surface)" }}
                />
                <div style={{ flex: "0 0 180px" }}>
                  <CalendarField
                    name="paidFrom"
                    placeholder="Paid from"
                    value={filters.paidFrom}
                    onChange={(event) => handleFilterChange("paidFrom", event.target.value)}
                    style={{ background: "var(--surface)" }}
                  />
                </div>
                <div style={{ flex: "0 0 180px" }}>
                  <CalendarField
                    name="paidTo"
                    placeholder="Paid to"
                    value={filters.paidTo}
                    onChange={(event) => handleFilterChange("paidTo", event.target.value)}
                    style={{ background: "var(--surface)" }}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear filters
                </Button>
              </ToolbarRow>
            </DevLayoutSection>
          </DevLayoutSection>

          {/* Table */}
          <DevLayoutSection
            sectionKey="payslips-table"
            sectionType="data-table"
            parentKey="payslips-page-shell"
            className="app-section-card"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {loading ? "Loading payslips…" : `${payslips.length} payslip${payslips.length === 1 ? "" : "s"}`}
              </div>
              <Button type="button" variant="primary" size="sm" pill onClick={() => setIsCreateOpen(true)}>
                New payslip
              </Button>
            </div>

            {error ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md, 12px)",
                  background: "rgba(198, 40, 40, 0.08)",
                  color: "var(--danger, #c62828)",
                  fontSize: "0.88rem",
                }}
              >
                {error?.message || "Unable to load payslips."}
              </div>
            ) : null}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-secondary)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "8px 12px" }}>Paid date</th>
                    <th style={{ padding: "8px 12px" }}>User</th>
                    <th style={{ padding: "8px 12px" }}>Department</th>
                    <th style={{ padding: "8px 12px" }}>Period</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Gross</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Net</th>
                    <th style={{ padding: "8px 12px" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && payslips.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                        No payslips match the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {payslips.map((slip) => {
                    const tone = getStatusTone(slip.status);
                    return (
                      <tr key={slip.id} style={{ background: "var(--surface)" }}>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{formatDate(slip.paidDate)}</strong>
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                              {slip.user?.name || `User ${slip.userId}`}
                            </span>
                            {slip.user?.email ? (
                              <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{slip.user.email}</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)", color: "var(--text-secondary)" }}>
                          {slip.user?.department || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)", color: "var(--text-secondary)" }}>
                          {formatPeriodLabel(slip)}
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)", textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(slip.grossPay)}
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)", textAlign: "right", fontWeight: 700, color: "var(--accentText, var(--accent))" }}>
                          {formatCurrency(slip.netPay)}
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: tone.bg,
                              color: tone.color,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {formatStatusLabel(slip.status)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <Button type="button" variant="ghost" size="xs" onClick={() => setActivePayslip(slip)}>
                              View
                            </Button>
                            <Button type="button" variant="secondary" size="xs" onClick={() => setEditingPayslip(slip)}>
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" size="xs" onClick={() => handleDelete(slip)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DevLayoutSection>
        </div>
      </DevLayoutSection>

      <PayslipUpsertModal
        isOpen={isCreateOpen}
        mode="create"
        users={users}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => fetchPayslips()}
      />

      <PayslipUpsertModal
        isOpen={Boolean(editingPayslip)}
        mode="edit"
        users={users}
        initialPayslip={editingPayslip}
        onClose={() => setEditingPayslip(null)}
        onSaved={() => fetchPayslips()}
      />

      <PayslipDetailPopup
        isOpen={Boolean(activePayslip)}
        payslip={activePayslip}
        onClose={() => setActivePayslip(null)}
      />
    </ProtectedRoute>
  );
}
