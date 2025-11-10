// file location: src/pages/admin/users/index.js
import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../../components/Layout";
import AdminUserForm from "../../../components/Admin/AdminUserForm";
import {
  confirmationUsers,
  usersByDepartment,
  usersByRoleDetailed,
} from "../../../config/users";
import { SectionCard, StatusTag } from "../../../components/HR/MetricCard";

export default function AdminUserManagement() {
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewMember, setPreviewMember] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const departmentList = useMemo(() => {
    return Object.entries(usersByDepartment)
      .map(([department, names]) => ({
        department,
        names: names.sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, []);

  const roleList = useMemo(() => {
    return Object.entries(usersByRoleDetailed)
      .map(([role, entries]) => ({
        role,
        members: entries.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, []);

  const userCount = Object.keys(confirmationUsers).length;

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

  const handleUserCreated = (user) => {
    setDbUsers((prev) => [user, ...prev]);
    setShowAddForm(false);
  };

  const handleUserDelete = async (userId, name) => {
    if (!userId) return;
    const label = name ? `${name}` : "this user";
    const confirmed = window.confirm(
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
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Provision platform accounts and review department ownership. These records are driven by the shared confirmation roster for consistent testing.
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
            <div style={{ color: "#B91C1C", marginBottom: "12px", fontWeight: 600 }}>{dbError}</div>
          )}
          {dbLoading ? (
            <div style={{ color: "#6B7280" }}>Reading users…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <p style={{ color: "#4B5563", margin: "0 0 12px" }}>
                This table reflects the live <code>users</code> table in Supabase. Any additions or deletions
                performed here instantly update the database and associated activity logs.
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
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
                    <tr key={account.id} style={{ borderTop: "1px solid #E5E7EB" }}>
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
                      <td colSpan={6} style={{ padding: "14px", textAlign: "center", color: "#6B7280" }}>
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
          subtitle="Canonical roster pulled from confirmation/user.js"
          action={<StatusTag label={`${userCount} people`} tone="default" />}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {departmentList.map(({ department, names }) => (
              <div key={department} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{department}</h3>
                <ul style={{ margin: 0, paddingLeft: "18px", color: "#4B5563" }}>
                  {names.map((name) => (
                    <li key={`${department}-${name}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Roles & Members"
          subtitle="Cross-reference roles with associated team members"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                  <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                  <th>Members</th>
                  <th>Departments</th>
                </tr>
              </thead>
                <tbody>
                  {roleList.map(({ role, members }) => (
                    <tr key={role} style={{ borderTop: "1px solid #E5E7EB" }}>
                      <td style={{ padding: "12px 0", fontWeight: 600 }}>{role}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {(members || []).map((member) => (
                            <button
                              key={`${role}-${member.displayName}`}
                              type="button"
                          onClick={() => handleProfileView(member)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "999px",
                                border: "1px solid #E5E7EB",
                                background:
                                  activeUser === member.displayName ? "#111827" : "white",
                                color:
                                  activeUser === member.displayName ? "white" : "#1F2937",
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
                      </td>
                      <td>
                        {Array.from(
                          new Set(
                            members.flatMap((member) => member.departments || [])
                          )
                        ).join(", ")}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                style={{ width: "100%", height: "500px", border: "1px solid #E5E7EB", borderRadius: "12px" }}
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
  border: "1px solid #DBEAFE",
  background: "white",
  color: "#2563EB",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#B91C1C",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px",
  zIndex: 1000,
};

const modalContentStyle = {
  background: "white",
  borderRadius: "16px",
  padding: "20px",
  width: "min(900px, 100%)",
  boxShadow: "0 15px 40px rgba(15,23,42,0.25)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const modalCloseButtonStyle = {
  border: "none",
  background: "transparent",
  fontSize: "1.25rem",
  cursor: "pointer",
  color: "#6B7280",
};

const secondaryButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  background: "white",
  color: "#1F2937",
  fontWeight: 600,
  cursor: "not-allowed",
  opacity: 0.6,
};

const primaryActionButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#1D4ED8",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
