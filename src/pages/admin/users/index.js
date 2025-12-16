// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/admin/users/index.js
import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import AdminUserForm from "@/components/Admin/AdminUserForm";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import { useRoster } from "@/context/RosterContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

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

  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(null);
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

  const departmentList = useMemo(() => {
    const grouped = directory.reduce((acc, employee) => {
        const dept = employee.department || "Unassigned";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(employee.name || employee.email || employee.id);
        return acc;
      }, {});

    return Object.entries(grouped)
      .map(([department, names]) => ({
        department,
        names: names.sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [directory]);

  const roleList = useMemo(() => {
    return Object.entries(usersByRoleDetailed || {})
      .map(([role, entries]) => ({
        role,
        members: (entries || [])
          .map((member) => ({
            ...member,
            displayName: member.name || member.email || `User ${member.id}`,
            departments: member.departments || [],
          }))
          .sort((a, b) => {
            const nameCompare = (a.displayName || "").localeCompare(b.displayName || "");
            if (nameCompare !== 0) return nameCompare;
            // Add stable secondary sort by id to prevent users with same name from switching
            return (a.id || 0) - (b.id || 0);
          }),
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
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
      `Are you sure you want to remove ${label} from the system? All linked records will be deleted.`
    );
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to delete user");
      }
      setDbUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      alert(err.message || "Unable to delete user");
    }
  };
  const handleProfileView = (member) => {
    if (!member) return;
    setActiveUser(member.displayName);
    setPreviewMember(member);
    setShowModal(true);
  };

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <header>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Provision platform accounts and review department ownership. These records are driven by the shared Supabase roster for consistent testing.
          </p>
        </header>

        {showAddForm && <AdminUserForm onCreated={handleUserCreated} />}

        <SectionCard
          title="Live Platform Users"
          subtitle={dbLoading ? "Loading user roster" : "Manage accounts stored in Supabase"}
          action={
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={() => setShowAddForm((prev) => !prev)} style={primaryActionButtonStyle}>
                {showAddForm ? "Close Form" : "Add User"}
              </button>
              <button type="button" onClick={fetchDbUsers} style={refreshButtonStyle}>
                Refresh
              </button>
            </div>
          }
        >
          {dbError && (
            <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>{dbError}</div>
          )}
          {dbLoading ? (
            <div style={{ color: "var(--info)" }}>Reading users…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <p style={{ color: "var(--info-dark)", margin: "0 0 12px" }}>
                This table reflects the live <code>users</code> table in Supabase. Any additions or deletions
                performed here instantly update the database and associated activity logs.
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dbUsers.map((account) => (
                    <tr key={account.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 600 }}>
                        {account.firstName} {account.lastName}
                      </td>
                      <td>{account.email}</td>
                      <td>{account.role}</td>
                      <td>{account.phone || "—"}</td>
                      <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleUserDelete(account.id, `${account.firstName} ${account.lastName}`.trim())}
                          style={dangerButtonStyle}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dbUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "14px", textAlign: "center", color: "var(--info)" }}>
                        No platform users available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="User Directory Snapshot"
          subtitle="Live roster pulled from Supabase users & HR employee profiles"
          action={<StatusTag label={`${userCount} people`} tone="default" />}
        >
          {directoryError && (
            <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
              {directoryError}
            </div>
          )}
          {directoryLoading ? (
            <div style={{ color: "var(--info)" }}>Loading employee directory…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              {departmentList.map(({ department, names }) => (
                <div key={department} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--accent-purple)" }}>{department}</h3>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--info-dark)" }}>
                    {names.map((name) => (
                      <li key={`${department}-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {departmentList.length === 0 && (
                <div style={{ color: "var(--info)" }}>No departments available.</div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Roles & Members"
          subtitle="Cross-reference roles with associated team members"
        >
          {rosterLoading ? (
            <div style={{ color: "var(--info)" }}>Loading roster…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {roleList.map(({ role, members }) => (
                    <tr key={role} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 600 }}>{role}</td>
                      <td>
                        {members.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {members.map((member) => (
                              <button
                                key={`${role}-${member.id || member.displayName}`}
                                type="button"
                                onClick={() => handleProfileView(member)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--accent-purple-surface)",
                                  background: activeUser === member.displayName ? "var(--accent-purple)" : "white",
                                  color: activeUser === member.displayName ? "white" : "var(--info-dark)",
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {member.displayName}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--info)" }}>No members assigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {showModal && previewMember && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  {previewMember.displayName} &mdash; Profile Preview
                </h3>
                <button type="button" onClick={() => { setShowModal(false); setActiveUser(null); }} style={modalCloseButtonStyle}>
                  ✕
                </button>
              </div>
              <iframe
                title={`${previewMember.displayName} profile`}
                src={`/admin/profiles/${encodeURIComponent(previewMember.key || previewMember.displayName)}`}
                style={{ width: "100%", height: "500px", border: "1px solid var(--accent-purple-surface)", borderRadius: "12px" }}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button type="button" style={secondaryButtonStyle} disabled>
                  Edit profile (coming soon)
                </button>
                <button type="button" style={secondaryButtonStyle} disabled>
                  Manage documents
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const refreshButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--info-surface)",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid var(--danger-surface)",
  background: "var(--danger-surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: 1500,
  padding: "20px",
};

const modalContentStyle = {
  ...popupCardStyles,
  width: "min(900px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px",
};

const modalCloseButtonStyle = {
  border: "none",
  background: "transparent",
  fontSize: "1.25rem",
  cursor: "pointer",
  color: "var(--info)",
};

const secondaryButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  background: "var(--surface)",
  color: "var(--info-dark)",
  fontWeight: 600,
  cursor: "not-allowed",
  opacity: 0.6,
};

const primaryActionButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
