// file location: src/components/dev-platform/sections/DevSidebarAccess.js
//
// Developer Platform -> Sidebar Access. Lets developers preview each central
// role default and manage a user's presentation-only sidebar layout override.

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
import {
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getWorkspacePageCatalog,
} from "@/config/workspace/manifest";

const userDisplayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Unnamed user";

const moduleToDraft = (module) => ({
  key: module.key,
  label: module.label,
  items: module.items.map((item) => item.href),
});

const draftFromUser = (user) =>
  getRoleWorkspaceModules(user?.role ? [user.role] : [], user?.sidebarAccess).map(moduleToDraft);

const moveItem = (items, index, direction) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
};

const slugify = (label) =>
  String(label || "module")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "module";

function RoleDefaultCard({
  role,
  modules,
  catalogByHref,
  sectionKey,
  parentKey,
  active = false,
  onUseForCopy,
}) {
  const pageCount = modules.reduce((count, module) => count + module.items.length, 0);
  return (
    <SubSurface
      as="div"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={{ gap: "12px", minWidth: 0 }}
    >
      <DevLayoutSection
        sectionKey={`${sectionKey}-header`}
        parentKey={sectionKey}
        sectionType="section-shell"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: "var(--accentText)" }}>{role}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
            <Pill label={`${modules.length} modules`} tone="text-1" />
            <Pill label={`${pageCount} pages`} tone="text-1" />
          </div>
        </div>
        <DevButton small onClick={onUseForCopy} disabled={active}>
          {active ? "Copy source" : "Use for copy"}
        </DevButton>
      </DevLayoutSection>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {modules.map((module) => (
          <div key={`${role}-${module.key}`} style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--text-1)" }}>{module.label}</div>
            {module.items.map((href) => {
              const item = catalogByHref.get(href);
              return (
                <div
                  key={`${role}-${module.key}-${href}`}
                  className="app-btn app-btn--secondary app-btn--nav"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    cursor: "default",
                    pointerEvents: "none",
                    marginLeft: "12px",
                    maxWidth: "calc(100% - 12px)",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item?.label || href}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </SubSurface>
  );
}

export default function DevSidebarAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [previewRole, setPreviewRole] = useState(WORKSPACE_ROLE_DEFAULT_NAMES[0]);
  const [draftModules, setDraftModules] = useState([]);
  const [newModuleLabel, setNewModuleLabel] = useState("");
  const [pageSelections, setPageSelections] = useState({});

  const catalog = useMemo(() => getWorkspacePageCatalog(), []);
  const catalogByHref = useMemo(
    () => new Map(catalog.map((item) => [item.href, item])),
    [catalog]
  );
  const roleDefaultPreviews = useMemo(
    () => WORKSPACE_ROLE_DEFAULT_NAMES.map((role) => ({
      role,
      modules: getRoleDefaultWorkspaceModules(role).map(moduleToDraft),
    })),
    []
  );

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

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  useEffect(() => {
    setDraftModules(selectedUser ? draftFromUser(selectedUser) : []);
    setPageSelections({});
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [userDisplayName(user), user.email, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, users]);

  const callApi = useCallback(async (payload) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dev/sidebar-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.message || `Save returned ${res.status}`);
      setUsers(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setError(e?.message || "Could not save sidebar access.");
    } finally {
      setSaving(false);
    }
  }, []);

  const selectedStatus = selectedUser?.sidebarAccess ? "User override" : "Inherited role default";

  const addModule = () => {
    const label = newModuleLabel.trim();
    if (!label) return;
    const existingKeys = new Set(draftModules.map((module) => module.key));
    let key = slugify(label);
    let counter = 2;
    while (existingKeys.has(key)) {
      key = `${slugify(label)}-${counter}`;
      counter += 1;
    }
    setDraftModules((current) => [...current, { key, label, items: [] }]);
    setNewModuleLabel("");
  };

  const updateModule = (index, updates) => {
    setDraftModules((current) =>
      current.map((module, moduleIndex) =>
        moduleIndex === index ? { ...module, ...updates } : module
      )
    );
  };

  const addPage = (moduleIndex) => {
    const href = pageSelections[moduleIndex];
    if (!href) return;
    setDraftModules((current) =>
      current.map((module, index) =>
        index === moduleIndex
          ? module.items.includes(href)
            ? module
            : { ...module, items: [...module.items, href] }
          : module.items.includes(href)
          ? { ...module, items: module.items.filter((itemHref) => itemHref !== href) }
          : module
      )
    );
  };

  const saveLayout = () => {
    if (!selectedUser) return;
    callApi({
      action: "save-layout",
      userId: selectedUser.id,
      sourceRole: selectedUser.sidebarAccess?.sourceRole || selectedUser.role,
      modules: draftModules,
    });
  };

  return (
    <>
      <Panel
        sectionKey="dev-sidebar-role-defaults"
        parentKey="app-layout-page-card"
        headerSectionKey="dev-sidebar-role-defaults-header"
        contentSectionKey="dev-sidebar-role-defaults-content"
        title="Role default sidebars"
        actions={<Pill label={`${WORKSPACE_ROLE_DEFAULT_NAMES.length} roles`} tone="accentText" strong />}
      >
        <DevLayoutSection
          sectionKey="dev-sidebar-role-default-matrix"
          parentKey="dev-sidebar-role-defaults-content"
          sectionType="section-shell"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--page-stack-gap, 12px)",
            alignItems: "start",
          }}
        >
          {roleDefaultPreviews.map(({ role, modules }) => (
            <RoleDefaultCard
              key={role}
              role={role}
              modules={modules}
              catalogByHref={catalogByHref}
              sectionKey={`dev-sidebar-role-default-${role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              parentKey="dev-sidebar-role-default-matrix"
              active={previewRole === role}
              onUseForCopy={() => setPreviewRole(role)}
            />
          ))}
        </DevLayoutSection>
      </Panel>

      <Panel
        sectionKey="dev-sidebar-user-editor"
        parentKey="app-layout-page-card"
        headerSectionKey="dev-sidebar-user-editor-header"
        contentSectionKey="dev-sidebar-user-editor-content"
        title="User sidebar overrides"
      >
        {loading ? (
          <LoadingBlock rows={3} />
        ) : error ? (
          <EmptyState
            title="Sidebar access unavailable"
            message={error}
            action={<DevButton small onClick={load}>Refresh</DevButton>}
          />
        ) : (
          <DevLayoutSection
            sectionKey="dev-sidebar-user-editor-grid"
            parentKey="dev-sidebar-user-editor-content"
            sectionType="section-shell"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 320px) minmax(0, 1fr)",
              gap: "var(--page-stack-gap, 12px)",
              alignItems: "start",
            }}
          >
            <SubSurface
              sectionKey="dev-sidebar-user-directory"
              parentKey="dev-sidebar-user-editor-grid"
              sectionType="content-card"
              style={{ gap: "10px", minWidth: 0 }}
            >
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users"
                aria-label="Search users"
                className="app-input"
                style={{ width: "100%" }}
              />
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                {filteredUsers.length} of {users.length} users
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "460px", overflowY: "auto", minWidth: 0 }}>
                {filteredUsers.map((user) => {
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
                        <span style={{ fontSize: "var(--text-body-xs)", opacity: 0.7 }}>{user.role || "No role"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </SubSurface>

            {!selectedUser ? (
              <EmptyState title="Select a user" message="Pick a user to preview, copy, edit, or restore their sidebar." />
            ) : (
              <DevLayoutSection
                sectionKey="dev-sidebar-selected-user"
                parentKey="dev-sidebar-user-editor-grid"
                sectionType="section-shell"
                style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)", minWidth: 0 }}
              >
                <SubSurface
                  sectionKey="dev-sidebar-selected-user-summary"
                  parentKey="dev-sidebar-selected-user"
                  sectionType="content-card"
                  style={{ gap: "10px" }}
                >
                  <DevLayoutSection
                    sectionKey="dev-sidebar-selected-user-summary-row"
                    parentKey="dev-sidebar-selected-user-summary"
                    sectionType="section-shell"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{userDisplayName(selectedUser)}</div>
                      <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.75 }}>{selectedUser.email}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Pill label={selectedUser.role || "No role"} tone="accentText" strong />
                      <Pill label={selectedStatus} tone={selectedUser.sidebarAccess ? "warning-base" : "success-base"} strong />
                    </div>
                  </DevLayoutSection>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <DevButton small onClick={() => callApi({ action: "copy-role", userId: selectedUser.id, sourceRole: previewRole })} disabled={saving}>
                      Copy {previewRole}
                    </DevButton>
                    <DevButton small onClick={saveLayout} disabled={saving || draftModules.length === 0}>
                      Save override
                    </DevButton>
                    <DevButton small onClick={() => callApi({ action: "restore-default", userId: selectedUser.id })} disabled={saving || !selectedUser.sidebarAccess}>
                      Restore role default
                    </DevButton>
                  </div>
                </SubSurface>

                <SubSurface
                  sectionKey="dev-sidebar-module-editor"
                  parentKey="dev-sidebar-selected-user"
                  sectionType="content-card"
                  style={{ gap: "12px" }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      className="app-input"
                      value={newModuleLabel}
                      onChange={(event) => setNewModuleLabel(event.target.value)}
                      placeholder="New module name"
                      aria-label="New module name"
                      style={{ flex: "1 1 220px" }}
                    />
                    <DevButton small onClick={addModule}>Add module</DevButton>
                  </div>

                  {draftModules.map((module, moduleIndex) => (
                    <SubSurface
                      as="div"
                      key={module.key}
                      sectionKey={`dev-sidebar-module-editor-${module.key}`}
                      parentKey="dev-sidebar-module-editor"
                      sectionType="content-card"
                      style={{ gap: "10px" }}
                    >
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          className="app-input"
                          value={module.label}
                          onChange={(event) => updateModule(moduleIndex, { label: event.target.value })}
                          aria-label={`Module ${moduleIndex + 1} label`}
                          style={{ flex: "1 1 220px" }}
                        />
                        <DevButton small onClick={() => setDraftModules((current) => moveItem(current, moduleIndex, -1))} disabled={moduleIndex === 0}>Up</DevButton>
                        <DevButton small onClick={() => setDraftModules((current) => moveItem(current, moduleIndex, 1))} disabled={moduleIndex === draftModules.length - 1}>Down</DevButton>
                        <DevButton small onClick={() => setDraftModules((current) => current.filter((_, index) => index !== moduleIndex))}>Remove</DevButton>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          className="app-input"
                          value={pageSelections[moduleIndex] || ""}
                          onChange={(event) => setPageSelections((current) => ({ ...current, [moduleIndex]: event.target.value }))}
                          aria-label={`Add page to ${module.label}`}
                          style={{ flex: "1 1 260px" }}
                        >
                          <option value="">Choose a page</option>
                          {catalog.map((item) => (
                            <option key={item.href} value={item.href}>
                              {item.label} ({item.href})
                            </option>
                          ))}
                        </select>
                        <DevButton small onClick={() => addPage(moduleIndex)} disabled={!pageSelections[moduleIndex]}>Add page</DevButton>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {module.items.length === 0 ? (
                          <EmptyState title="No pages in this module" />
                        ) : module.items.map((href, pageIndex) => {
                          const item = catalogByHref.get(href);
                          return (
                            <div
                              key={`${module.key}-${href}`}
                              style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}
                            >
                              <div className="app-btn app-btn--secondary app-btn--nav" style={{ flex: "1 1 220px", justifyContent: "flex-start", pointerEvents: "none" }}>
                                {item?.label || href}
                              </div>
                              <DevButton small onClick={() => updateModule(moduleIndex, { items: moveItem(module.items, pageIndex, -1) })} disabled={pageIndex === 0}>Up</DevButton>
                              <DevButton small onClick={() => updateModule(moduleIndex, { items: moveItem(module.items, pageIndex, 1) })} disabled={pageIndex === module.items.length - 1}>Down</DevButton>
                              <DevButton small onClick={() => updateModule(moduleIndex, { items: module.items.filter((itemHref) => itemHref !== href) })}>Remove</DevButton>
                            </div>
                          );
                        })}
                      </div>
                    </SubSurface>
                  ))}
                </SubSurface>
              </DevLayoutSection>
            )}
          </DevLayoutSection>
        )}
      </Panel>
    </>
  );
}
