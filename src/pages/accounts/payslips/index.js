// file location: src/pages/accounts/payslips/index.js
// Account-manager payslips workspace — logic layer only. Rendering lives in
// src/components/page-ui/accounts/payslips/payslips-ui.js to mirror the
// page-ui split used by the rest of /accounts.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import ToolbarRow from "@/components/ui/ToolbarRow";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import PayslipUpsertModal from "@/features/payslips/PayslipUpsertModal";
import PayslipDetailPopup from "@/features/payslips/PayslipDetailPopup";
import PayslipsAdminPageUi from "@/components/page-ui/accounts/payslips/payslips-ui";

const ALLOWED_ROLES = [
  "ADMIN",
  "ADMIN MANAGER",
  "OWNER",
  "ACCOUNTS",
  "ACCOUNTS MANAGER",
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses", placeholder: true },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const defaultFilters = {
  search: "",
  userId: "",
  department: "",
  status: "",
  paidFrom: "",
  paidTo: "",
};

export default function PayslipsAdminPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [payslips, setPayslips] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePayslip, setActivePayslip] = useState(null);
  const [editingPayslip, setEditingPayslip] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users/roster", { credentials: "include" });
      const json = await response.json().catch(() => null);
      if (json?.success) {
        setUsers(json.data?.allUsers || []);
      }
    } catch {
      // non-fatal — admin can still create payslips by entering details
    }
  }, []);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params.set(key, String(value));
        }
      });
      const response = await fetch(`/api/payslips/admin?${params.toString()}`, {
        credentials: "include",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || `Request failed with status ${response.status}`);
      }
      setPayslips(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => setFilters(defaultFilters);

  const userOptions = useMemo(
    () => [
      { value: "", label: "All users", placeholder: true },
      ...users.map((user) => ({ value: String(user.id), label: user.name })),
    ],
    [users]
  );

  const departmentOptions = useMemo(() => {
    const set = new Set();
    users.forEach((user) => {
      if (user.department) set.add(user.department);
    });
    return [
      { value: "", label: "All departments", placeholder: true },
      ...Array.from(set).sort().map((dept) => ({ value: dept, label: dept })),
    ];
  }, [users]);

  const handleDelete = async (payslip) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete payslip from ${payslip.paidDate} for ${payslip.user?.name || "this user"}?`
      );
      if (!confirmed) return;
    }
    try {
      const response = await fetch(`/api/payslips/${payslip.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || `Request failed with status ${response.status}`);
      }
      fetchPayslips();
    } catch (err) {
      window.alert(err?.message || "Unable to delete payslip.");
    }
  };

  return (
    <PayslipsAdminPageUi
      view="section1"
      ALLOWED_ROLES={ALLOWED_ROLES}
      Button={Button}
      CalendarField={CalendarField}
      DevLayoutSection={DevLayoutSection}
      DropdownField={DropdownField}
      PayslipDetailPopup={PayslipDetailPopup}
      PayslipUpsertModal={PayslipUpsertModal}
      ProtectedRoute={ProtectedRoute}
      SearchBar={SearchBar}
      STATUS_OPTIONS={STATUS_OPTIONS}
      ToolbarRow={ToolbarRow}
      activePayslip={activePayslip}
      departmentOptions={departmentOptions}
      editingPayslip={editingPayslip}
      error={error}
      fetchPayslips={fetchPayslips}
      filters={filters}
      handleDelete={handleDelete}
      handleFilterChange={handleFilterChange}
      handleResetFilters={handleResetFilters}
      isCreateOpen={isCreateOpen}
      loading={loading}
      payslips={payslips}
      setActivePayslip={setActivePayslip}
      setEditingPayslip={setEditingPayslip}
      setIsCreateOpen={setIsCreateOpen}
      userOptions={userOptions}
      users={users}
    />
  );
}
