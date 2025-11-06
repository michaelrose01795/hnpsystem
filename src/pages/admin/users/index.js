// file location: src/pages/admin/users/index.js
import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import AdminUserForm from "../../../components/Admin/AdminUserForm";
import {
  confirmationUsers,
  usersByDepartment,
  usersByRoleDetailed,
} from "../../../config/users";
import { SectionCard, StatusTag } from "../../../components/HR/MetricCard";
import { useUser } from "../../../context/UserContext";

export default function AdminUserManagement() {
  const router = useRouter();
  const { devLogin } = useUser() || {};
  const [activeUser, setActiveUser] = useState(null);

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
  const handleProfileView = (member, fallbackRole) => {
    if (!member) return;
    setActiveUser(member.displayName);
    const roleToApply = (member.roles && member.roles[0]) || fallbackRole || "employee";
    devLogin?.(member.displayName, roleToApply);
    router
      .push({
        pathname: "/profile",
        query: {
          user: member.key || member.displayName,
          adminPreview: "1",
        },
      })
      .finally(() => setActiveUser(null));
  };

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <header>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>Admin User Management</h1>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Provision platform accounts and review department ownership. These records are driven by the shared confirmation roster for consistent testing.
          </p>
        </header>

        <AdminUserForm />

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
                              onClick={() => handleProfileView(member, role)}
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
      </div>
    </Layout>
  );
}
