// file location: src/components/dev-platform/sections/DevSidebarAccess.js
//
// Developer Platform -> Sidebar Access. Module-first editor for assigning a
// standard department bundle to a user and then tailoring its visible pages.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import {
  Panel,
  SubSurface,
  badgeClass,
  EmptyState,
  LoadingBlock,
} from "@/components/support/dev/supportDevUi";
import {
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getAssignableSidebarPageCatalog,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getSidebarModuleCatalog,
} from "@/config/workspace/manifest";
import { SIDEBAR_ACCESS_UPDATED_EVENT } from "@/lib/sidebarAccess";

const userDisplayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  user?.email ||
  "Unnamed user";

const moduleToDraft = (module) => ({
  key: module.key,
  label: module.label,
  items: module.items.map((item) => item.href),
});

const modulesFromUser = (user) =>
  getRoleWorkspaceModules(user?.role ? [user.role] : [], user?.sidebarAccess).map(moduleToDraft);

// A stored user layout is authoritative. Re-expanding standard modules from the
// current catalogue here would silently restore pages the administrator unticked.
const draftFromUser = (user) => modulesFromUser(user);

// Colour coding for the module page map. A page that lives in more than one
// standard module is keyed on the exact SET of modules it belongs to, so the
// same shared page reads in the same colour inside every card it appears in.
// Pages that belong to a single module stay on the default body colour.
const SHARED_PAGE_COLOURS = [
  "var(--success-text)",
  "var(--info-dark)",
  "var(--complete-text)",
  "var(--warning-text)",
  "var(--authorised-text)",
  "var(--danger-text)",
];

// Every card is sized to the module with the most pages so the grid stays even.
const MAP_ROW_HEIGHT = 56;
const MAP_ROW_GAP = 6;

const buildModulePageMap = (modules) => {
  const ownersByHref = new Map();
  for (const bundle of modules) {
    for (const item of bundle.items) {
      if (!ownersByHref.has(item.href)) ownersByHref.set(item.href, []);
      ownersByHref.get(item.href).push(bundle.label);
    }
  }

  const colourBySignature = new Map();
  const colourByHref = new Map();
  for (const [href, labels] of ownersByHref) {
    if (labels.length < 2) continue;
    const signature = [...labels].sort().join(" + ");
    if (!colourBySignature.has(signature)) {
      colourBySignature.set(
        signature,
        SHARED_PAGE_COLOURS[colourBySignature.size % SHARED_PAGE_COLOURS.length]
      );
    }
    colourByHref.set(href, colourBySignature.get(signature));
  }

  const maxItems = modules.reduce((max, bundle) => Math.max(max, bundle.items.length), 0);

  return {
    ownersByHref,
    colourByHref,
    legend: [...colourBySignature.entries()].map(([signature, colour]) => ({ signature, colour })),
    maxItems,
    listHeight: maxItems > 0 ? maxItems * MAP_ROW_HEIGHT + (maxItems - 1) * MAP_ROW_GAP : 0,
    sharedCount: colourByHref.size,
  };
};

const serialiseModules = (modules) =>
  JSON.stringify(
    modules.map((module) => ({
      key: module.key,
      label: module.label.trim(),
      items: module.items,
    }))
  );

export default function DevSidebarAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [search, setSearch] = useState("");
  const [userListOpen, setUserListOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [copyRole, setCopyRole] = useState(WORKSPACE_ROLE_DEFAULT_NAMES[0]);
  const [draftModules, setDraftModules] = useState([]);
  const [initialModules, setInitialModules] = useState([]);
  const [assignedModulesOpen, setAssignedModulesOpen] = useState(false);
  const [copyLayoutOpen, setCopyLayoutOpen] = useState(false);
  const [modulePageMapOpen, setModulePageMapOpen] = useState(false);
  const [copyTargetIds, setCopyTargetIds] = useState([]);

  const catalog = useMemo(() => getAssignableSidebarPageCatalog(), []);
  const moduleCatalog = useMemo(() => getSidebarModuleCatalog(), []);
  const modulePageMap = useMemo(() => buildModulePageMap(moduleCatalog), [moduleCatalog]);
  const catalogByHref = useMemo(
    () => new Map(catalog.map((item) => [item.href, item])),
    [catalog]
  );
  const roleModuleOptions = useMemo(() => {
    const options = new Map();
    for (const role of WORKSPACE_ROLE_DEFAULT_NAMES) {
      for (const navigationModule of getRoleDefaultWorkspaceModules(role)) {
        if (!options.has(navigationModule.key)) options.set(navigationModule.key, new Map());
        for (const item of navigationModule.items) {
          options.get(navigationModule.key).set(item.href, item);
        }
      }
    }
    return new Map(
      [...options.entries()].map(([key, items]) => [key, [...items.values()]])
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/dev/users", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.message || `User endpoint returned ${res.status}`);
      setUsers(Array.isArray(body.data) ? body.data : []);
    } catch (error) {
      setLoadError(error?.message || "Could not load the user directory.");
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
    const sourceModules = selectedUser ? modulesFromUser(selectedUser) : [];
    const nextModules = selectedUser ? draftFromUser(selectedUser) : [];
    setDraftModules(nextModules);
    setInitialModules(sourceModules);
    setPageSelections({});
    setSaveError("");
    if (selectedUser?.role && WORKSPACE_ROLE_DEFAULT_NAMES.includes(selectedUser.role)) {
      setCopyRole(selectedUser.role);
    }
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

  const usedHrefs = useMemo(
    () => new Set(draftModules.flatMap((module) => module.items)),
    [draftModules]
  );
  const isDirty = serialiseModules(draftModules) !== serialiseModules(initialModules);
  const hasSavableModules = draftModules.some(
    (module) => module.label.trim() && module.items.length > 0
  );

  const callApi = useCallback(async (payload) => {
    setSaving(true);
    setSaveError("");
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
      if (typeof window !== "undefined") {
        const userIds = payload.action === "copy-layout"
          ? payload.targetUserIds
          : [payload.userId];
        window.dispatchEvent(new CustomEvent(SIDEBAR_ACCESS_UPDATED_EVENT, {
          detail: { userIds: (Array.isArray(userIds) ? userIds : []).map(Number) },
        }));
      }
      return body;
    } catch (error) {
      setSaveError(error?.message || "Could not save sidebar access.");
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateModule = (index, updates) => {
    setDraftModules((current) =>
      current.map((module, moduleIndex) =>
        moduleIndex === index ? { ...module, ...updates } : module
      )
    );
  };

  const addBundle = (bundle) => {
    const availableItems = bundle.items
      .map((item) => item.href)
      .filter((href) => !usedHrefs.has(href));
    if (availableItems.length === 0) return;
    setDraftModules((current) => {
      const assignedIndex = current.findIndex((module) => module.key === bundle.key);
      if (assignedIndex < 0) {
        return [
          ...current,
          { key: bundle.key, label: bundle.label, items: availableItems },
        ];
      }
      return current.map((module, moduleIndex) =>
        moduleIndex === assignedIndex
          ? { ...module, items: [...module.items, ...availableItems] }
          : module
      );
    });
  };

  const selectBundle = (bundle) => addBundle(bundle);

  const saveLayout = async () => {
    if (!selectedUser || !hasSavableModules) return null;
    const modules = draftModules.filter(
      (module) => module.label.trim() && module.items.length > 0
    );
    const result = await callApi({
      action: "save-layout",
      userId: selectedUser.id,
      sourceRole: selectedUser.sidebarAccess?.sourceRole || selectedUser.role,
      modules,
    });
    if (result) setInitialModules(modules);
    return result;
  };

  const closeCopyLayout = () => {
    if (saving) return;
    setCopyLayoutOpen(false);
    setCopyTargetIds([]);
  };

  const copyLayout = async () => {
    if (!selectedUser || copyTargetIds.length === 0 || !hasSavableModules) return;
    const result = await callApi({
      action: "copy-layout",
      userId: selectedUser.id,
      targetUserIds: copyTargetIds,
      sourceRole: selectedUser.sidebarAccess?.sourceRole || selectedUser.role,
      modules: draftModules.filter((module) => module.label.trim() && module.items.length > 0),
    });
    if (result) {
      setCopyLayoutOpen(false);
      setCopyTargetIds([]);
    }
  };

  const copyTargetOptions = useMemo(
    () => users
      .filter((user) => user.id !== selectedUser?.id)
      .map((user) => ({
        value: user.id,
        raw: user.id,
        label: `${userDisplayName(user)}${user.role ? ` - ${user.role}` : ""}`,
      })),
    [selectedUser?.id, users]
  );

  const selectedStatus = selectedUser?.sidebarAccess
    ? "Custom modules"
    : "Role default";

  return (
    <Panel
      sectionKey="dev-sidebar-user-editor"
      parentKey="app-layout-page-card"
      headerSectionKey="dev-sidebar-user-editor-header"
      contentSectionKey="dev-sidebar-user-editor-content"
      title="Sidebar module access"
      actions={(
        <>
          <span className="app-badge app-badge--accent-strong">{`${users.length} users`}</span>
          <button type="button" onClick={() => setModulePageMapOpen(true)} className="app-btn app-btn--secondary">Module page map</button>
        </>
      )}
    >
      {loading ? (
        <LoadingBlock rows={4} />
      ) : loadError ? (
        <EmptyState
          title="Sidebar access unavailable"
          message={loadError}
          action={<button type="button" onClick={load} className="app-btn app-btn--secondary">Refresh</button>}
        />
      ) : (
        <DevLayoutSection
          sectionKey="dev-sidebar-user-editor-grid"
          parentKey="dev-sidebar-user-editor-content"
          sectionType="section-shell"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap, 12px)",
            minWidth: 0,
          }}
        >
          <SubSurface
            sectionKey="dev-sidebar-user-directory"
            parentKey="dev-sidebar-user-editor-grid"
            sectionType="content-card"
            style={{ gap: "10px", minWidth: 0 }}
          >
            <div style={{ fontWeight: 700, color: "var(--accentText)" }}>Choose a user</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setSearch(nextSearch);
                  if (nextSearch.trim()) setUserListOpen(true);
                }}
                placeholder="Search users"
                aria-label="Search users"
                className="app-input"
                style={{ flex: "1 1 260px", minWidth: 0 }}
              />
              <button
                type="button"
                className="app-btn app-btn--secondary"
                onClick={() => setUserListOpen((current) => !current)}
                aria-expanded={userListOpen}
                aria-controls="dev-sidebar-user-list"
              >
                {userListOpen ? "Hide list" : "Show list"}
              </button>
            </div>
            {userListOpen ? (
              <div
                id="dev-sidebar-user-list"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "6px", maxHeight: "360px", overflowY: "auto", minWidth: 0 }}
              >
                {filteredUsers.length === 0 ? (
                  <EmptyState title="No matching users" message="Try a different name, email, or role." />
                ) : filteredUsers.map((user) => {
                  const active = user.id === selectedUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setUserListOpen(false);
                      }}
                      className={`app-btn app-btn--secondary app-btn--nav${active ? " is-active" : ""}`}
                      style={{ height: "auto" }}
                    >
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                          {userDisplayName(user)}
                        </span>
                        <span style={{ fontSize: "var(--text-caption)", opacity: 0.7 }}>
                          {user.role || "No role"}{user.sidebarAccess ? " - customised" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </SubSurface>

          {!selectedUser ? (
            <EmptyState
              title="Select a user"
              message="Choose a user, assign complete modules, then tailor the pages inside each module."
            />
          ) : (
            <DevLayoutSection
              sectionKey="dev-sidebar-selected-user"
              parentKey="dev-sidebar-user-editor-grid"
              sectionType="section-shell"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: "var(--page-stack-gap, 12px)", alignItems: "start", minWidth: 0 }}
            >
              <SubSurface
                sectionKey="dev-sidebar-selected-user-summary"
                parentKey="dev-sidebar-selected-user"
                sectionType="content-card"
                style={{ gap: "12px" }}
              >
                <DevLayoutSection
                  sectionKey="dev-sidebar-selected-user-summary-row"
                  parentKey="dev-sidebar-selected-user-summary"
                  sectionType="section-shell"
                  style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{userDisplayName(selectedUser)}</div>
                    <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.75 }}>{selectedUser.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span className="app-badge app-badge--accent-strong">{selectedUser.role || "No role"}</span>
                    <span className={badgeClass(selectedUser.sidebarAccess ? "warning-base" : "success-base", true)}>{selectedStatus}</span>
                    {isDirty ? <span className="app-badge app-badge--warning-strong">Unsaved changes</span> : null}
                  </div>
                </DevLayoutSection>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "8px", alignItems: "end" }}>
                  <DropdownField
                    label="Copy another role default"
                    value={copyRole}
                    onChange={(event) => setCopyRole(event.target.value)}
                    options={WORKSPACE_ROLE_DEFAULT_NAMES.map((role) => ({
                      value: role,
                      label: role,
                    }))}
                    aria-label="Copy another role default"
                    style={{ width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const roleModules = getRoleDefaultWorkspaceModules(copyRole).map(moduleToDraft);
                      setDraftModules(roleModules);
                    }}
                    disabled={saving}
                    className="app-btn app-btn--secondary"
                  >
                    Load role modules
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={saveLayout} disabled={saving || !isDirty || !hasSavableModules} className="app-btn app-btn--primary">
                    {saving ? "Saving" : "Save modules"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCopyTargetIds([]);
                      setSaveError("");
                      setCopyLayoutOpen(true);
                    }}
                    disabled={saving || !hasSavableModules}
                    className="app-btn app-btn--secondary"
                  >
                    Copy layout
                  </button>
                  <button type="button" onClick={() => setDraftModules(initialModules)} disabled={saving || !isDirty} className="app-btn app-btn--secondary">
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => callApi({ action: "restore-default", userId: selectedUser.id })}
                    disabled={saving || !selectedUser.sidebarAccess}
                    className="app-btn app-btn--secondary"
                  >
                    Restore own role default
                  </button>
                </div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>
                  This controls sidebar visibility. Existing page and API role guards remain in force.
                </div>
                {saveError ? (
                  <div role="alert" style={{ color: "var(--danger-base)", fontSize: "var(--text-body-sm)" }}>
                    {saveError}
                  </div>
                ) : null}
              </SubSurface>

              <SubSurface
                sectionKey="dev-sidebar-module-library"
                parentKey="dev-sidebar-selected-user"
                sectionType="content-card"
                style={{ gap: "12px" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: "var(--accentText)" }}>Select standard modules</div>
                  <button type="button" onClick={() => setAssignedModulesOpen(true)} disabled={saving} className="app-btn app-btn--secondary">
                    Assigned modules ({draftModules.length})
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "8px" }}>
                  {moduleCatalog.map((bundle) => {
                    const availableCount = bundle.items.filter((item) => !usedHrefs.has(item.href)).length;
                    const assigned = draftModules.some((module) => module.key === bundle.key);
                    return (
                      <button
                        key={bundle.key}
                        type="button"
                        onClick={() => selectBundle(bundle)}
                        disabled={!assigned && availableCount === 0}
                        aria-pressed={assigned}
                        aria-label={
                          assigned && availableCount > 0
                            ? `Add ${availableCount} missing pages to ${bundle.label} module`
                            : assigned
                            ? `${bundle.label} module selected`
                            : `Select ${bundle.label} module`
                        }
                        className={`app-btn app-btn--secondary${assigned ? " is-active" : ""}`}
                        style={{ minHeight: 56, height: "auto", justifyContent: "space-between", textAlign: "left" }}
                      >
                        <span>{bundle.label}</span>
                        <span style={{ fontSize: "var(--text-caption)", opacity: 0.7 }}>
                          {assigned
                            ? availableCount > 0
                              ? `Add ${availableCount} missing`
                              : "Selected"
                            : `${availableCount} pages`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SubSurface>

            </DevLayoutSection>
          )}
        </DevLayoutSection>
      )}

      <PopupModal
        isOpen={assignedModulesOpen}
        onClose={() => setAssignedModulesOpen(false)}
        closeOnBackdrop={!saving}
        ariaLabel="Assigned sidebar modules"
        cardStyle={{
          width: "min(960px, 100%)",
          height: "calc(100dvh - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
          padding: "var(--section-card-padding)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Panel
          sectionKey="dev-sidebar-assigned-modules-popup"
          parentKey="shared-popup-card"
          headerSectionKey="dev-sidebar-assigned-modules-popup-header"
          contentSectionKey="dev-sidebar-assigned-modules-popup-content"
          title="Assigned modules"
          style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
          contentStyle={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}
          actions={(
            <>
              <span className="app-badge app-badge--neutral">{`${draftModules.length} modules`}</span>
              <span className={badgeClass(isDirty ? "warning-base" : "success-base", true)}>{isDirty ? "Unsaved changes" : "Saved"}</span>
              <button
                type="button"
                onClick={saveLayout}
                disabled={saving || !isDirty || !hasSavableModules}
                className="app-btn app-btn--primary"
              >
                {saving ? "Saving" : "Save"}
              </button>
              <button type="button" onClick={() => setAssignedModulesOpen(false)} disabled={saving} className="app-btn app-btn--secondary">
                Close
              </button>
            </>
          )}
        >
          {draftModules.length === 0 ? (
            <EmptyState
              title="No modules assigned"
              message="Add a standard module or load a role default."
            />
          ) : draftModules.map((module, moduleIndex) => {
            const bundle = moduleCatalog.find((item) => item.key === module.key);
            const visibleItems = bundle?.items || roleModuleOptions.get(module.key) ||
              module.items.map((href) => catalogByHref.get(href)).filter(Boolean);
            const selectedCount = module.items.length;
            return (
              <SubSurface
                as="section"
                id={`sidebar-module-${module.key}`}
                key={module.key}
                sectionKey={`dev-sidebar-module-${module.key}`}
                parentKey="dev-sidebar-assigned-modules-popup-content"
                sectionType="content-card"
                style={{ gap: "12px" }}
              >
                {/* Module-library sweep (2026-09): the Module page map library is
                    the only layout a user can have, so this header is read-only.
                    The label came from a free-text input (rename), and Up/Down
                    reordered the modules — both produced layouts that existed in
                    no library module. Removing a PAGE (the checkboxes below) is
                    the only per-user edit; clearing every page in a module drops
                    the module, which is what the old Remove button did. */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 220px", fontWeight: 700, color: "var(--accentText)" }}>{module.label}</span>
                  <span className="app-badge app-badge--neutral">{`${selectedCount} pages`}</span>
                  {bundle ? <span className="app-badge app-badge--success">Standard module</span> : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "6px" }}>
                  {visibleItems.map((item) => {
                    const checked = module.items.includes(item.href);
                    const owner = draftModules.find((candidate, index) =>
                      index !== moduleIndex && candidate.items.includes(item.href)
                    );
                    return (
                      <label
                        key={`${module.key}-${item.href}`}
                        style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: 44, padding: "6px 8px", color: "var(--text-1)", cursor: owner ? "not-allowed" : "pointer", opacity: owner ? 0.6 : 1 }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(owner)}
                          onChange={(event) => updateModule(moduleIndex, {
                            items: event.target.checked
                              ? [...module.items, item.href]
                              : module.items.filter((href) => href !== item.href),
                          })}
                        />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600 }}>{item.label}</span>
                          <span style={{ display: "block", fontSize: "var(--text-caption)", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {owner ? `Already in ${owner.label}` : item.href}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* "Add page" is gone with the module-library sweep: it could drop
                    ANY catalogue page into a non-standard module, which is exactly
                    the page mixing the library forbids. A module's pages are now
                    fixed by the library; a user's layout is a subset of them. */}
              </SubSurface>
            );
          })}
        </Panel>
      </PopupModal>

      <PopupModal
        isOpen={modulePageMapOpen}
        onClose={() => setModulePageMapOpen(false)}
        ariaLabel="Module page map"
        cardStyle={{
          width: "min(1100px, 100%)",
          height: "calc(100dvh - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
          padding: "var(--section-card-padding)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Panel
          sectionKey="dev-sidebar-module-page-map-popup"
          parentKey="shared-popup-card"
          headerSectionKey="dev-sidebar-module-page-map-popup-header"
          contentSectionKey="dev-sidebar-module-page-map-popup-content"
          title="Module page map"
          style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
          contentStyle={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}
          actions={(
            <>
              <span className="app-badge app-badge--neutral">{`${moduleCatalog.length} modules`}</span>
              <span className={badgeClass(modulePageMap.sharedCount > 0 ? "warning-base" : "success-base", true)}>{`${modulePageMap.sharedCount} shared pages`}</span>
              <button type="button" onClick={() => setModulePageMapOpen(false)} className="app-btn app-btn--secondary">Close</button>
            </>
          )}
        >
          <SubSurface
            sectionKey="dev-sidebar-module-page-map-legend"
            parentKey="dev-sidebar-module-page-map-popup-content"
            sectionType="content-card"
            style={{ gap: "8px" }}
          >
            <div style={{ fontWeight: 700, color: "var(--accentText)" }}>Shared page colours</div>
            {modulePageMap.legend.length === 0 ? (
              <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.75 }}>
                No page appears in more than one standard module.
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {modulePageMap.legend.map((entry) => (
                  <span
                    key={entry.signature}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--text-body-sm)", fontWeight: 600, color: entry.colour }}
                  >
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: entry.colour }} />
                    {entry.signature}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>
              A page in a single module uses the standard body colour. Every card is sized to the
              largest module ({modulePageMap.maxItems} pages) so the grid stays even.
            </div>
          </SubSurface>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
              gap: "var(--page-stack-gap, 12px)",
              alignItems: "stretch",
              marginTop: "var(--page-stack-gap, 12px)",
            }}
          >
            {moduleCatalog.map((bundle) => (
              <SubSurface
                as="section"
                key={bundle.key}
                sectionKey={`dev-sidebar-module-page-map-${bundle.key}`}
                parentKey="dev-sidebar-module-page-map-popup-content"
                sectionType="content-card"
                style={{ gap: "10px", minWidth: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minHeight: 28 }}>
                  <span style={{ fontWeight: 700, color: "var(--accentText)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bundle.label}
                  </span>
                  <span className="app-badge app-badge--neutral">{`${bundle.items.length}`}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: `${MAP_ROW_GAP}px`,
                    height: modulePageMap.listHeight,
                    minHeight: modulePageMap.listHeight,
                    maxHeight: modulePageMap.listHeight,
                    minWidth: 0,
                  }}
                >
                  {bundle.items.map((item) => {
                    const owners = modulePageMap.ownersByHref.get(item.href) || [];
                    const others = owners.filter((label) => label !== bundle.label);
                    const colour = modulePageMap.colourByHref.get(item.href);
                    return (
                      <div
                        key={`${bundle.key}-${item.href}`}
                        className="app-btn app-btn--secondary"
                        title={others.length > 0 ? `${item.href} - also in ${others.join(", ")}` : item.href}
                        style={{
                          height: MAP_ROW_HEIGHT,
                          minHeight: MAP_ROW_HEIGHT,
                          flex: "0 0 auto",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          justifyContent: "center",
                          textAlign: "left",
                          gap: "2px",
                          minWidth: 0,
                        }}
                      >
                        <span style={{ color: colour, fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.label}
                        </span>
                        <span style={{ color: colour, fontSize: "var(--text-caption)", opacity: 0.75, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {others.length > 0 ? `Also in ${others.join(", ")}` : item.href}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SubSurface>
            ))}
          </div>
        </Panel>
      </PopupModal>

      <PopupModal
        isOpen={copyLayoutOpen}
        onClose={closeCopyLayout}
        closeOnBackdrop={!saving}
        ariaLabel="Copy sidebar layout"
        cardStyle={{
          width: "min(560px, 100%)",
          padding: "var(--section-card-padding)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--layout-card-gap)",
          overflow: "visible",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--layout-card-gap)", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <h2 style={{ margin: 0, color: "var(--accentText)" }}>Copy sidebar layout</h2>
            <p style={{ margin: "6px 0 0", color: "var(--text-1)", opacity: 0.75, fontSize: "var(--text-body-sm)" }}>
              Copy {userDisplayName(selectedUser)}&apos;s current layout to one or more staff members.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={copyLayout}
              disabled={saving || copyTargetIds.length === 0 || !hasSavableModules}
              className="app-btn app-btn--secondary"
            >
              {saving ? "Saving" : "Save"}
            </button>
            <button type="button" onClick={closeCopyLayout} disabled={saving} className="app-btn app-btn--primary">
              Close
            </button>
          </div>
        </div>

        <MultiSelectDropdown
          label="Copy layout to"
          placeholder="Select staff members"
          searchPlaceholder="Search staff members"
          options={copyTargetOptions}
          value={copyTargetIds}
          onChange={setCopyTargetIds}
          disabled={saving}
          emptyState="No other staff members are available"
          helperText={copyTargetIds.length > 0 ? `${copyTargetIds.length} staff selected` : "Select one or more staff members."}
          maxHeight="min(320px, 45vh)"
        />

        {saveError ? (
          <div role="alert" style={{ color: "var(--danger-base)", fontSize: "var(--text-body-sm)" }}>
            {saveError}
          </div>
        ) : null}
      </PopupModal>
    </Panel>
  );
}
