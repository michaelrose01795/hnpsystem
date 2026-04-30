// file location: src/pages/admin/users/index.js
// ✅ Imports converted to use absolute alias "@/"
import React, { useEffect, useMemo, useState } from "react";
import AdminUserForm from "@/components/Admin/AdminUserForm";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { StatusTag } from "@/components/HR/MetricCard"; // status badge component
import { useRoster } from "@/context/RosterContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import {
  SkeletonBlock,
  SkeletonKeyframes,
  SkeletonTableRow,
  InlineLoading } from
"@/components/ui/LoadingSkeleton";
import AdminUserManagementUi from "@/components/page-ui/admin/users/admin-users-ui"; // Extracted presentation layer.

const defaultCompanyProfile = {
  company_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  phone_service: "",
  phone_parts: "",
  website: "",
  bank_name: "",
  sort_code: "",
  account_number: "",
  account_name: "",
  payment_reference_hint: ""
};

export default function AdminUserManagement() {
  const { usersByRole, usersByRoleDetailed, allUsers, isLoading: rosterLoading } = useRoster();
  const { confirm } = useConfirmation();
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewMember, setPreviewMember] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [companyProfile, setCompanyProfile] = useState(defaultCompanyProfile);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyMessage, setCompanyMessage] = useState("");
  const [companySaving, setCompanySaving] = useState(false);

  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(null);
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

  const departmentList = useMemo(() => {
    const grouped = directory.reduce((acc, employee) => {
      const dept = employee.department || "Unassigned";
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(employee.name || employee.email || "Unknown user");
      return acc;
    }, {});

    return Object.entries(grouped).
    map(([department, names]) => ({
      department,
      names: names.sort((a, b) => a.localeCompare(b))
    })).
    sort((a, b) => a.department.localeCompare(b.department));
  }, [directory]);

  const roleList = useMemo(() => {
    return Object.entries(usersByRoleDetailed || {}).
    map(([role, entries]) => ({
      role,
      members: (entries || []).
      map((member) => ({
        ...member,
        displayName: member.name || member.email || "Unknown user",
        departments: member.departments || []
      })).
      sort((a, b) => {
        const nameCompare = (a.displayName || "").localeCompare(b.displayName || "");
        if (nameCompare !== 0) return nameCompare;
        // Add stable secondary sort by id to prevent users with same name from switching
        return (a.id || 0) - (b.id || 0);
      })
    })).
    sort((a, b) => a.role.localeCompare(b.role));
  }, [usersByRoleDetailed]);

  const userCount = allUsers.length;

  const fetchDbUsers = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const response = await fetch("/api/admin/users");
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to load users");
      }
      setDbUsers(payload.data || []);
    } catch (err) {
      setDbError(err.message || "Unable to load users");
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchDbUsers();
  }, []);

  useEffect(() => {
    const loadCompanyProfile = async () => {
      setCompanyLoading(true);
      setCompanyMessage("");
      try {
        const response = await fetch("/api/settings/company-profile");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load company profile");
        }
        setCompanyProfile({ ...defaultCompanyProfile, ...(payload.data || {}) });
      } catch (error) {
        console.error("Failed to load company profile", error);
        setCompanyMessage(error.message || "Unable to load company profile.");
      } finally {
        setCompanyLoading(false);
      }
    };
    loadCompanyProfile();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadDirectory = async () => {
      setDirectoryLoading(true);
      setDirectoryError(null);
      try {
        const response = await fetch("/api/hr/employees", { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Failed to load employee directory");
        }
        setDirectory(payload.data || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setDirectoryError(err.message || "Unable to load employee directory");
        setDirectory([]);
      } finally {
        setDirectoryLoading(false);
      }
    };

    loadDirectory();
    return () => controller.abort();
  }, []);

  const handleUserCreated = (user) => {
    setDbUsers((prev) => [user, ...prev]);
    setShowAddForm(false);
  };

  const handleUserDelete = async (userId, name) => {
    if (!userId) return;
    const label = name ? `${name}` : "this user";
    const confirmed = await confirm(
      `Are you sure you want to deactivate ${label}? They will be marked as inactive and can be restored later.`
    );
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to deactivate user");
      }
      setDbUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      alert(err.message || "Unable to deactivate user");
    }
  };

  const handleCompanyInputChange = (field, value) => {
    setCompanyProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompanySave = async () => {
    setCompanyMessage("");
    setCompanySaving(true);
    try {
      const response = await fetch("/api/settings/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyProfile)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save company profile");
      }
      setCompanyProfile(payload.data || defaultCompanyProfile);
      setCompanyMessage("Company & bank details saved.");
    } catch (error) {
      console.error("Failed to save company profile", error);
      setCompanyMessage(error.message || "Unable to save company profile.");
    } finally {
      setCompanySaving(false);
    }
  };
  const handleProfileView = (member) => {
    if (!member) return;
    setActiveUser(member.displayName);
    setPreviewMember(member);
    setShowModal(true);
  };

  return <AdminUserManagementUi view="section1" activeUser={activeUser} AdminUserForm={AdminUserForm} companyLoading={companyLoading} companyMessage={companyMessage} companyProfile={companyProfile} companySaving={companySaving} dangerButtonStyle={dangerButtonStyle} dbError={dbError} dbLoading={dbLoading} dbUsers={dbUsers} departmentList={departmentList} directoryError={directoryError} directoryLoading={directoryLoading} fetchDbUsers={fetchDbUsers} handleCompanyInputChange={handleCompanyInputChange} handleCompanySave={handleCompanySave} handleProfileView={handleProfileView} handleUserCreated={handleUserCreated} handleUserDelete={handleUserDelete} InlineLoading={InlineLoading} modalCloseButtonStyle={modalCloseButtonStyle} modalContentStyle={modalContentStyle} modalOverlayStyle={modalOverlayStyle} previewMember={previewMember} primaryActionButtonStyle={primaryActionButtonStyle} refreshButtonStyle={refreshButtonStyle} roleList={roleList} rosterLoading={rosterLoading} secondaryButtonStyle={secondaryButtonStyle} SectionCard={SectionCard} setActiveUser={setActiveUser} setShowAddForm={setShowAddForm} setShowModal={setShowModal} showAddForm={showAddForm} showModal={showModal} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} SkeletonTableRow={SkeletonTableRow} StatusTag={StatusTag} userCount={userCount} />;








































































































































































































































































































































































































}

const refreshButtonStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer"
};

const dangerButtonStyle = {
  padding: "6px 12px",
  borderRadius: "var(--radius-xs)",
  border: "none",
  background: "var(--danger-surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer"
};

const modalOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: 1500,
  padding: "20px"
};

const modalContentStyle = {
  ...popupCardStyles,
  width: "min(900px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "var(--page-card-padding)"
};

const modalCloseButtonStyle = {
  border: "none",
  background: "transparent",
  fontSize: "1.25rem",
  cursor: "pointer",
  color: "var(--info)"
};

const secondaryButtonStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--theme)",
  background: "var(--surface)",
  color: "var(--info-dark)",
  fontWeight: 600,
  cursor: "not-allowed",
  opacity: 0.6
};

const primaryActionButtonStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer"
};
