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
import LayerTheme from "@/components/ui/LayerTheme";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";

export default function PayslipsAdminPageUi(uiProps) {
  const {
    ALLOWED_ROLES,
    Button,
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
              <table className="app-data-table" style={{ minWidth: "1180px", fontSize: "0.88rem" }}>
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
                  <tr style={{ textAlign: "left", color: "var(--text-1)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "10px 18px" }}>Paid date</th>
                    <th style={{ padding: "10px 18px" }}>User</th>
                    <th style={{ padding: "10px 18px" }}>Department</th>
                    <th style={{ padding: "10px 18px" }}>Period</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Gross</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Net</th>
                    <th style={{ padding: "10px 18px" }}>Status</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Actions</th>
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
                    const tone = getStatusTone(slip.status);
                    return (
                      <tr key={slip.id} style={{ background: "var(--surface)" }}>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)" }}>
                          <strong style={{ color: "var(--text-1)" }}>{formatDate(slip.paidDate)}</strong>
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <span style={{ color: "var(--text-1)", fontWeight: 600 }}>
                              {slip.user?.name || `User ${slip.userId}`}
                            </span>
                            {slip.user?.email ? (
                              <span style={{ color: "var(--text-1)", fontSize: "0.78rem" }}>{slip.user.email}</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)", color: "var(--text-1)" }}>
                          {slip.user?.department || "—"}
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)", color: "var(--text-1)" }}>
                          {formatPeriodLabel(slip)}
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)", textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(slip.grossPay)}
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)", textAlign: "right", fontWeight: 700, color: "var(--accentText, var(--accent))" }}>
                          {formatCurrency(slip.netPay)}
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)" }}>
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
                        <td style={{ padding: "12px 18px", borderTop: "var(--separating-line)", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <Button type="button" variant="primary" size="xs" className="app-table-action-btn" onClick={() => setActivePayslip(slip)}>
                              View
                            </Button>
                            <Button type="button" variant="primary" size="xs" className="app-table-action-btn" onClick={() => setEditingPayslip(slip)}>
                              Edit
                            </Button>
                            <Button type="button" variant="primary" size="xs" className="app-table-action-btn" onClick={() => handleDelete(slip)}>
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
    </ProtectedRoute>
  );
}
