// file location: src/components/page-ui/accounts/payslips/payslips-ui.js
// Presentation layer for the account-manager payslips workspace. Mirrors the
// /accounts/index.js → accounts-ui.js split so all rendering lives outside the
// page logic file.

import {
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  formatStatusLabel,
} from "@/features/payslips/payslipUtils";
import LayerTheme from "@/components/ui/LayerTheme";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";

// Payslip status → staffglobal .app-badge tone modifier.
const STATUS_BADGE_TONE = {
  paid: "app-badge--success",
  issued: "app-badge--accent-soft",
  draft: "app-badge--neutral",
  void: "app-badge--danger",
};
const statusToneClass = (status) =>
  STATUS_BADGE_TONE[String(status || "").toLowerCase()] || "app-badge--neutral";

export default function PayslipsAdminPageUi(uiProps) {
  const {
    ALLOWED_ROLES,
    Button,
    ConfirmationDialog,
    DevLayoutSection,
    DropdownField,
    PayslipDetailPopup,
    PayslipUpsertModal,
    ProtectedRoute,
    SearchBar,
    STATUS_OPTIONS,
    ToolbarRow,
    activePayslip,
    confirmDialog,
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
    setConfirmDialog,
    setEditingPayslip,
    setIsCreateOpen,
    userOptions,
    users,
  } = uiProps;

  if (uiProps.view !== "section1") return null;

  const paidMonthValue = (filters.paidFrom || "").slice(0, 7);
  const handlePaidMonthChange = (value) => {
    if (!value) {
      handleFilterChange("paidFrom", "");
      handleFilterChange("paidTo", "");
      return;
    }

    const [year, month] = value.split("-").map(Number);
    const first = `${value}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const last = `${value}-${String(lastDay).padStart(2, "0")}`;
    handleFilterChange("paidFrom", first);
    handleFilterChange("paidTo", last);
  };

  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <DevLayoutSection sectionKey="payslips-page-shell" sectionType="page-shell" shell>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Filter toolbar — lives in the main page section, above the table card */}
          <DevLayoutSection sectionKey="payslips-filter-toolbar" sectionType="filter-row" parentKey="payslips-page-shell">
            <ToolbarRow>
              <SearchBar
                name="search"
                placeholder="Search reference, period or notes"
                value={filters.search}
                onChange={(event) => handleFilterChange("search", event.target.value)}
                onClear={() => handleFilterChange("search", "")}
                style={{ flex: "1 1 240px" }}
              />
              <DropdownField
                name="userId"
                value={filters.userId}
                onChange={(event) => handleFilterChange("userId", event.target.value)}
                options={userOptions}
                style={{ flex: "0 0 220px" }}
              />
              <DropdownField
                name="department"
                value={filters.department}
                onChange={(event) => handleFilterChange("department", event.target.value)}
                options={departmentOptions}
                style={{ flex: "0 0 200px" }}
              />
              <DropdownField
                name="status"
                value={filters.status}
                onChange={(event) => handleFilterChange("status", event.target.value)}
                options={STATUS_OPTIONS}
                style={{ flex: "0 0 160px" }}
              />
              <div style={{ flex: "0 0 260px", minWidth: "220px" }}>
                <MonthPickerField
                  aria-label="Paid month"
                  value={paidMonthValue}
                  onValueChange={handlePaidMonthChange}
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                New payslip
              </Button>
            </ToolbarRow>
          </DevLayoutSection>

          {/* Table card — only wraps the table itself */}
          <LayerTheme
            sectionKey="payslips-table"
            sectionType="data-table"
            parentKey="payslips-page-shell"
            gap="12px"
          >
            {error ? (
              <p className="app-status-message app-status-message--danger" style={{ margin: 0 }}>
                {error?.message || "Unable to load payslips."}
              </p>
            ) : null}

            <div className="app-table-shell-scroll" style={{ overflowX: "auto" }}>
              <table className="app-data-table app-table-shell app-table-shell--with-headings" style={{ minWidth: "1180px", fontSize: "0.88rem" }}>
                <colgroup>
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "270px" }} />
                  <col style={{ width: "160px" }} />
                  <col style={{ width: "180px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "210px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Paid date</th>
                    <th>User</th>
                    <th>Department</th>
                    <th>Period</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                    <th style={{ textAlign: "right" }}>Net</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && payslips.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--text-1)" }}>
                        No payslips match the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {payslips.map((slip) => {
                    return (
                      <tr key={slip.id}>
                        <td>
                          <strong style={{ color: "var(--text-1)" }}>{formatDate(slip.paidDate)}</strong>
                        </td>
                        <td>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <span style={{ color: "var(--text-1)", fontWeight: 600 }}>
                              {slip.user?.name || `User ${slip.userId}`}
                            </span>
                            {slip.user?.email ? (
                              <span style={{ color: "var(--surfaceTextMuted)", fontSize: "0.78rem" }}>{slip.user.email}</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-1)" }}>
                          {slip.user?.department || "—"}
                        </td>
                        <td style={{ color: "var(--text-1)" }}>
                          {formatPeriodLabel(slip)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(slip.grossPay)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-accent)" }}>
                          {formatCurrency(slip.netPay)}
                        </td>
                        <td>
                          <span className={`app-badge app-badge--control app-badge--uppercase ${statusToneClass(slip.status)}`}>
                            {formatStatusLabel(slip.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button type="button" className="app-table-action-btn app-table-action-btn--primary" onClick={() => setActivePayslip(slip)}>
                              View
                            </button>
                            <button type="button" className="app-table-action-btn app-table-action-btn--primary" onClick={() => setEditingPayslip(slip)}>
                              Edit
                            </button>
                            <button type="button" className="app-table-action-btn app-table-action-btn--danger" onClick={() => handleDelete(slip)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LayerTheme>
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

      <ConfirmationDialog
        isOpen={Boolean(confirmDialog)}
        message={confirmDialog?.message}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm}
      />
    </ProtectedRoute>
  );
}
