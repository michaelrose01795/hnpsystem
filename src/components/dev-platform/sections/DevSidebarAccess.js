// file location: src/components/dev-platform/sections/DevSidebarAccess.js
//
// Developer Platform → "Sidebar Access". Three tools on one dev-gated page:
//   1. FULL SIDEBAR GROUP REFERENCE — every navigable group, its assigned roles,
//      and its live sidebar structure (Dashboards sub-heading + the group-name
//      sub-heading + page buttons) exactly as the Group Sidebar now renders it.
//   2. USER ACCESS EXPLORER — the full user directory; click a user to see the
//      groups their role grants, each rendered as a live sidebar preview.
//   3. GROUP MULTI-SELECT PREVIEW — pick any groups to preview their full live
//      sidebar alongside the selected user.
//
// Everything is a pure projection of the workspace manifest (getWorkspaceGroups /
// getDepartmentWorkspaceNav / getWorkspaceGroupRoles), so this page can never
// drift from the real sidebar. CLAUDE.md: borderless LayerSurface/LayerTheme
// panels (via supportDevUi), token-only colour, 44px targets, canonical
// MultiSelectDropdown for the group picker.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import {
  Panel,
  SubSurface,
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";
import MultiSelectDropdown from "@/components/ui/dropdownAPI/MultiSelectDropdown";
import {
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  getAllSidebarItems,
  getWorkspaceGroups,
  getDepartmentWorkspaceNav,
  getWorkspaceGroupRoles,
  getWorkspaceModules,
} from "@/config/workspace/manifest";
import { roleCategories } from "@/config/users";

// Every configured role (+ the synthetic dev role), lowercased. Passing this as
// the role set to getDepartmentWorkspaceNav reveals a group's FULL contents — the
// maximal set of buttons any of its users could see — for the reference view.
const ALL_ROLES = Array.from(
  new Set([
    ...Object.values(roleCategories).flat().map((r) => String(r).toLowerCase().trim()),
    "dev",
  ])
).filter(Boolean);

// The navigable groups (General + every department). Mirrors getWorkspaceGroups'
// filter — the Account bucket is not a group (it is the sidebar's bottom controls).
const NAV_GROUPS = WORKSPACE_DEPARTMENTS.filter(
  (dept) =>
    (dept.category === "general" || dept.category === "departments") &&
    dept.key !== "developer"
);
const ACCESS_GROUPS = getAllSidebarItems().filter(
  (group) => group.category === "general" || group.category === "departments"
);
const REFERENCE_GROUPS = NAV_GROUPS.map((department) => {
  const editable = ACCESS_GROUPS.find((group) => group.department === department.key);
  if (editable) return { ...editable, modules: getWorkspaceModules(department.key, ALL_ROLES) };
  const nav = getDepartmentWorkspaceNav(department.key, ALL_ROLES);
  return {
    department: department.key,
    label: department.label,
    category: department.category,
    locked: true,
    modules: getWorkspaceModules(department.key, ALL_ROLES),
    items: [
      ...nav.dashboards.map((item) => ({ ...item, kind: "dashboard" })),
      ...nav.items.map((item) => ({ ...item, kind: "page" })),
    ],
  };
});
const REFERENCE_PAGE_BUTTON_COUNT = REFERENCE_GROUPS.reduce(
  (count, group) => {
    const pageHrefs = new Set(
      group.items.filter((item) => item.kind !== "dashboard").map((item) => item.href)
    );
    const groupedHrefs = new Set();
    const groupedButtonCount = WORKSPACE_NAV_SECTIONS
      .filter((section) => section.department === group.department)
      .reduce((sectionCount, section) => (
        sectionCount + section.items.filter((item) => {
          if (!item.href || !pageHrefs.has(item.href)) return false;
          groupedHrefs.add(item.href);
          return true;
        }).length
      ), 0);
    const dashboardCount = group.items.filter((item) => item.kind === "dashboard").length;
    const remainingPageCount = [...pageHrefs].filter((href) => !groupedHrefs.has(href)).length;
    return count + dashboardCount + groupedButtonCount + remainingPageCount;
  },
  0
);
const REFERENCE_MODULE_COUNT = REFERENCE_GROUPS.reduce(
  (count, group) => count + getWorkspaceModules(group.department, ALL_ROLES).length,
  0
);

const groupLabel = (key) =>
  WORKSPACE_DEPARTMENTS.find((dept) => dept.key === key)?.label || key;

const rolesLabelFor = (key) => {
  const roles = getWorkspaceGroupRoles(key);
  if (roles === "*") return "All authenticated users";
  if (!roles || roles.length === 0) return "Page-role gated only";
  return roles.join(", ");
};

// One static sidebar-button row (non-interactive). Reuses the real nav button
// classes so the preview matches the live rail 1:1; pointer events are off so it
// reads as a preview, not a link.
function PreviewNavRow({ label }) {
  return (
    <div
      className="app-btn app-btn--secondary app-btn--nav"
      style={{ width: "100%", justifyContent: "flex-start", cursor: "default", pointerEvents: "none" }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

// A single group's live sidebar preview: the exact structure the Group Sidebar
// renders — a "Dashboards" sub-heading + dashboards, then the group-name
// sub-heading + its page buttons. `roles` controls which buttons resolve (a
// user's own role for their view, or ALL_ROLES for the full reference).
function SidebarGroupPreview({
  groupKey,
  roles,
  sidebarAccess,
  sectionKey,
  parentKey,
  showRoles = true,
  showRoleGroups = false,
}) {
  const [expandedModuleKeys, setExpandedModuleKeys] = useState(() => new Set());
  const nav = getDepartmentWorkspaceNav(groupKey, roles, sidebarAccess);
  const label = nav.label || groupLabel(groupKey);
  const hasContent = nav.dashboards.length > 0 || nav.items.length > 0;
  const visibleItemHrefs = new Set(nav.items.map((item) => item.href));
  const roleGroups = getWorkspaceModules(groupKey, roles, sidebarAccess)
    .map((module) => ({ ...module, items: module.items.filter((item) => visibleItemHrefs.has(item.href)) }))
    .filter((module) => module.items.length > 0);
  const groupedHrefs = new Set(
    roleGroups.flatMap((section) => section.items.map((item) => item.href))
  );
  const remainingItems = showRoleGroups
    ? nav.items.filter((item) => !groupedHrefs.has(item.href))
    : nav.items;

  return (
    <SubSurface
      as="div"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={{
        gap: "10px",
        minWidth: 0,
        cursor: "default",
        textAlign: "left",
        width: "100%",
      }}
    >
      <DevLayoutSection
        sectionKey={`${sectionKey}-header`}
        parentKey={sectionKey}
        sectionType="section-shell"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}
      >
        <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{label}</div>
        {showRoles ? <Pill label={rolesLabelFor(groupKey)} tone="text-1" /> : null}
      </DevLayoutSection>

      {!hasContent ? (
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
          No sidebar items for these roles.
        </div>
      ) : (
        <>
          {nav.dashboards.length > 0 && (
            <DevLayoutSection
              sectionKey={`${sectionKey}-dashboards`}
              parentKey={sectionKey}
              sectionType="section-shell"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div className="app-sidebar__section-title">Dashboards</div>
              {nav.dashboards.map((d) => (
                <PreviewNavRow key={`dash-${d.href}`} label={d.label} />
              ))}
            </DevLayoutSection>
          )}
          {roleGroups.map((roleGroup) => {
            const expanded = expandedModuleKeys.has(roleGroup.key);
            const toggleModule = () => {
              setExpandedModuleKeys((current) => {
                const next = new Set(current);
                if (next.has(roleGroup.key)) next.delete(roleGroup.key);
                else next.add(roleGroup.key);
                return next;
              });
            };
            return (
            <DevLayoutSection
              key={`${groupKey}-${roleGroup.key}`}
              sectionKey={`${sectionKey}-role-group-${roleGroup.key}`}
              parentKey={sectionKey}
              sectionType="section-shell"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <button type="button" className="app-btn app-btn--secondary app-btn--nav" onClick={toggleModule} aria-expanded={expanded}>
                {`${expanded ? "⌄" : "›"} ${roleGroup.label}`}
              </button>
              {expanded && roleGroup.items.map((item) => (
                <div key={`${roleGroup.key}-${item.href}`} style={{ marginLeft: "16px" }}><PreviewNavRow label={item.label} /></div>
              ))}
            </DevLayoutSection>
            );
          })}
          {remainingItems.length > 0 && (
            <DevLayoutSection
              sectionKey={`${sectionKey}-pages`}
              parentKey={sectionKey}
              sectionType="section-shell"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div
                className="app-sidebar__section-title"
                style={{ marginTop: nav.dashboards.length > 0 ? "12px" : 0 }}
              >
                {label}
              </div>
              {remainingItems.map((it) => (
                <PreviewNavRow key={`item-${it.href}`} label={it.label} />
              ))}
            </DevLayoutSection>
          )}
        </>
      )}
    </SubSurface>
  );
}

const userDisplayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Unnamed user";

export default function DevSidebarAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [previewGroupKeys, setPreviewGroupKeys] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dev/users", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.message || `User endpoint returned ${res.status}`);
      setUsers(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setError(e?.message || "Could not load the user directory.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      [userDisplayName(u), u.email, u.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
    );
  }, [users, search]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );
  const selectedUserRoles = useMemo(
    () => (selectedUser?.role ? [String(selectedUser.role)] : []),
    [selectedUser]
  );
  const selectedUserGroups = useMemo(
    () => (selectedUser ? getWorkspaceGroups(selectedUserRoles, selectedUser.sidebarAccess) : []),
    [selectedUser, selectedUserRoles]
  );

  const groupOptions = useMemo(
    () => NAV_GROUPS.map((g) => ({ value: g.key, label: g.label })),
    []
  );

  return (
    <>
      {/* 1. FULL SIDEBAR GROUP REFERENCE ----------------------------------- */}
      <Panel
        sectionKey="dev-sidebar-access-group-reference"
        parentKey="app-layout-page-card"
        headerSectionKey="dev-sidebar-access-group-reference-header"
        contentSectionKey="dev-sidebar-access-group-reference-content"
        title="Sidebar group reference"
        actions={(
          <Pill
            label={`${REFERENCE_GROUPS.length} groups · ${REFERENCE_MODULE_COUNT} modules · ${REFERENCE_PAGE_BUTTON_COUNT} pages`}
            tone="accentText"
            strong
          />
        )}
      >
        <DevLayoutSection
          sectionKey="dev-sidebar-access-group-reference-grid"
          parentKey="dev-sidebar-access-group-reference-content"
          sectionType="section-shell"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "var(--page-stack-gap, 12px)",
            alignItems: "start",
          }}
        >
          {NAV_GROUPS.map((group) => (
            <SidebarGroupPreview
              key={group.key}
              groupKey={group.key}
              roles={ALL_ROLES}
              sectionKey={`dev-sidebar-access-reference-${group.key}`}
              parentKey="dev-sidebar-access-group-reference-grid"
              showRoleGroups
            />
          ))}
        </DevLayoutSection>
      </Panel>

      {/* 2 + 3. USER ACCESS EXPLORER + MULTI-SELECT PREVIEW ----------------- */}
      <Panel
        sectionKey="dev-sidebar-access-user-explorer"
        parentKey="app-layout-page-card"
        headerSectionKey="dev-sidebar-access-user-explorer-header"
        contentSectionKey="dev-sidebar-access-user-explorer-content"
        title="User access explorer"
      >
        {loading ? (
          <LoadingBlock rows={3} />
        ) : error ? (
          <EmptyState
            title="Directory unavailable"
            message={error}
            action={<DevButton small onClick={load}>Try again</DevButton>}
          />
        ) : (
          <DevLayoutSection
            sectionKey="dev-sidebar-access-user-explorer-grid"
            parentKey="dev-sidebar-access-user-explorer-content"
            sectionType="section-shell"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 320px) minmax(0, 1fr)",
              gap: "var(--page-stack-gap, 12px)",
              alignItems: "start",
            }}
          >
            {/* Left — searchable user list. */}
            <SubSurface
              sectionKey="dev-sidebar-access-user-directory"
              parentKey="dev-sidebar-access-user-explorer-grid"
              sectionType="content-card"
              style={{ gap: "10px", minWidth: 0 }}
            >
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
                className="app-input"
                style={{ width: "100%" }}
              />
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                {filteredUsers.length} of {users.length} users
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "460px", overflowY: "auto", minWidth: 0 }}>
                {filteredUsers.length === 0 ? (
                  <EmptyState title="No users match" />
                ) : (
                  filteredUsers.map((user) => {
                    const active = user.id === selectedUserId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`app-btn app-btn--secondary app-btn--nav${active ? " is-active" : ""}`}
                        style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", height: "auto", minHeight: 44, padding: "6px 12px" }}
                      >
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                            {userDisplayName(user)}
                          </span>
                          <span style={{ fontSize: "var(--text-body-xs)", opacity: 0.7 }}>
                            {user.role || "No role"}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </SubSurface>

            {/* Right — selected user's available groups + multi-select preview. */}
            <DevLayoutSection
              sectionKey="dev-sidebar-access-user-detail-column"
              parentKey="dev-sidebar-access-user-explorer-grid"
              sectionType="section-shell"
              style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)", minWidth: 0 }}
            >
              {!selectedUser ? (
                <EmptyState
                  title="Select a user"
                  message="Pick a user on the left to see which sidebar groups their role grants, and preview any other group alongside."
                />
              ) : (
                <>
                  <SubSurface
                    sectionKey="dev-sidebar-access-selected-user-summary"
                    parentKey="dev-sidebar-access-user-detail-column"
                    sectionType="content-card"
                    style={{ gap: "6px" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "var(--text-h4, 15px)", color: "var(--accentText)" }}>
                      {userDisplayName(selectedUser)}
                    </div>
                    <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8 }}>
                      {selectedUser.email}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                      <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>Role</span>
                      <Pill label={selectedUser.role || "No role"} tone="accentText" strong />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                        Effective groups ({selectedUserGroups.length})
                      </span>
                      {selectedUserGroups.length === 0 ? (
                        <Pill label="None" tone="text-1" />
                      ) : (
                        selectedUserGroups.map((g) => <Pill key={g.key} label={g.label} tone="success-base" strong />)
                      )}
                    </div>
                  </SubSurface>

                  {/* The user's own groups, rendered as they would see them. */}
                  {selectedUserGroups.length > 0 && (
                    <DevLayoutSection
                      sectionKey="dev-sidebar-access-selected-user-groups"
                      parentKey="dev-sidebar-access-user-detail-column"
                      sectionType="section-shell"
                    >
                      <div className="app-sidebar__section-title" style={{ marginBottom: "8px" }}>
                        {userDisplayName(selectedUser)}&apos;s sidebar
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                          gap: "var(--page-stack-gap, 12px)",
                          alignItems: "start",
                        }}
                      >
                        {selectedUserGroups.map((g) => (
                          <SidebarGroupPreview
                            key={g.key}
                            groupKey={g.key}
                            roles={selectedUserRoles}
                            sidebarAccess={selectedUser.sidebarAccess}
                            sectionKey={`dev-sidebar-access-user-group-${g.key}`}
                            parentKey="dev-sidebar-access-selected-user-groups"
                            showRoles={false}
                          />
                        ))}
                      </div>
                    </DevLayoutSection>
                  )}

                  {/* Multi-select any other groups to preview their full sidebar. */}
                  <SubSurface
                    sectionKey="dev-sidebar-access-other-groups-preview"
                    parentKey="dev-sidebar-access-user-detail-column"
                    sectionType="content-card"
                    style={{ gap: "10px" }}
                  >
                    <MultiSelectDropdown
                      label="Preview other groups"
                      placeholder="Select groups to preview"
                      options={groupOptions}
                      value={previewGroupKeys}
                      onChange={setPreviewGroupKeys}
                      helperText="Live full-sidebar preview of each selected group (all roles), independent of the user above."
                    />
                    {previewGroupKeys.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                          gap: "var(--page-stack-gap, 12px)",
                          alignItems: "start",
                        }}
                      >
                        {previewGroupKeys.map((key) => (
                          <SidebarGroupPreview
                            key={key}
                            groupKey={key}
                            roles={ALL_ROLES}
                            sectionKey={`dev-sidebar-access-other-group-${key}`}
                            parentKey="dev-sidebar-access-other-groups-preview"
                          />
                        ))}
                      </div>
                    )}
                  </SubSurface>
                </>
              )}
            </DevLayoutSection>
          </DevLayoutSection>
        )}
      </Panel>
    </>
  );
}
