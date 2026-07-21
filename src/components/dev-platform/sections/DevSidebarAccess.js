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
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";
import {
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getSidebarModuleCatalog,
  getWorkspacePageCatalog,
} from "@/config/workspace/manifest";
import { syncAssignedStandardModules } from "@/lib/sidebarAccess";

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

const draftFromUser = (user) => syncAssignedStandardModules(modulesFromUser(user));

const moveItem = (items, index, direction) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
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
  const [pageSelections, setPageSelections] = useState({});
  const [assignedModulesOpen, setAssignedModulesOpen] = useState(false);
  const [copyLayoutOpen, setCopyLayoutOpen] = useState(false);
  const [copyTargetIds, setCopyTargetIds] = useState([]);

  const catalog = useMemo(() => getWorkspacePageCatalog(), []);
  const moduleCatalog = useMemo(() => getSidebarModuleCatalog(), []);
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

  const addPage = (moduleIndex) => {
    const href = pageSelections[moduleIndex];
    if (!href || usedHrefs.has(href)) return;
    updateModule(moduleIndex, {
      items: [...draftModules[moduleIndex].items, href],
    });
    setPageSelections((current) => ({ ...current, [moduleIndex]: "" }));
  };

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
      actions={<Pill label={`${users.length} users`} tone="accentText" strong />}
    >
      {loading ? (
        <LoadingBlock rows={4} />
      ) : loadError ? (
        <EmptyState
          title="Sidebar access unavailable"
          message={loadError}
          action={<DevButton onClick={load}>Refresh</DevButton>}
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
                className="app-btn app-btn--ghost"
                onClick={() => setUserListOpen((current) => !current)}
                aria-expanded={userListOpen}
                aria-controls="dev-sidebar-user-list"
                style={{ minHeight: 44 }}
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
                      style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", height: "auto", minHeight: 44, padding: "6px 12px" }}
                    >
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                          {userDisplayName(user)}
                        </span>
                        <span style={{ fontSize: "var(--text-body-xs)", opacity: 0.7 }}>
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
                    <Pill label={selectedUser.role || "No role"} tone="accentText" strong />
                    <Pill label={selectedStatus} tone={selectedUser.sidebarAccess ? "warning-base" : "success-base"} strong />
                    {isDirty ? <Pill label="Unsaved changes" tone="warning-base" strong /> : null}
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
                  <DevButton
                    onClick={() => {
                      const roleModules = getRoleDefaultWorkspaceModules(copyRole).map(moduleToDraft);
                      setDraftModules(roleModules);
                    }}
                    disabled={saving}
                  >
                    Load role modules
                  </DevButton>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <DevButton variant="solid" onClick={saveLayout} disabled={saving || !isDirty || !hasSavableModules}>
                    {saving ? "Saving" : "Save modules"}
                  </DevButton>
                  <DevButton
                    onClick={() => {
                      setCopyTargetIds([]);
                      setSaveError("");
                      setCopyLayoutOpen(true);
                    }}
                    disabled={saving || !hasSavableModules}
                  >
                    Copy layout
                  </DevButton>
                  <DevButton onClick={() => setDraftModules(initialModules)} disabled={saving || !isDirty}>
                    Discard changes
                  </DevButton>
                  <DevButton
                    onClick={() => callApi({ action: "restore-default", userId: selectedUser.id })}
                    disabled={saving || !selectedUser.sidebarAccess}
                  >
                    Restore own role default
                  </DevButton>
                </div>
                <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
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
                  <DevButton onClick={() => setAssignedModulesOpen(true)} disabled={saving}>
                    Assigned modules ({draftModules.length})
                  </DevButton>
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
                        style={{ minHeight: 56, height: "auto", justifyContent: "space-between", textAlign: "left", padding: "8px 12px" }}
                      >
                        <span>{bundle.label}</span>
                        <span style={{ fontSize: "var(--text-body-xs)", opacity: 0.7 }}>
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
          padding: "var(--section-card-padding)",
        }}
      >
        <Panel
          sectionKey="dev-sidebar-assigned-modules-popup"
          parentKey="shared-popup-card"
          headerSectionKey="dev-sidebar-assigned-modules-popup-header"
          contentSectionKey="dev-sidebar-assigned-modules-popup-content"
          title="Assigned modules"
          actions={(
            <>
              <Pill label={`${draftModules.length} modules`} tone="text-1" />
              <Pill
                label={isDirty ? "Unsaved changes" : "Saved"}
                tone={isDirty ? "warning-base" : "success-base"}
                strong
              />
              <DevButton
                variant="solid"
                onClick={saveLayout}
                disabled={saving || !isDirty || !hasSavableModules}
              >
                {saving ? "Saving" : "Save"}
              </DevButton>
              <DevButton onClick={() => setAssignedModulesOpen(false)} disabled={saving}>
                Close
              </DevButton>
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
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className="app-input"
                    value={module.label}
                    onChange={(event) => updateModule(moduleIndex, { label: event.target.value })}
                    aria-label={`Module ${moduleIndex + 1} label`}
                    style={{ flex: "1 1 220px", fontWeight: 700 }}
                  />
                  <Pill label={`${selectedCount} pages`} tone="text-1" />
                  {bundle ? <Pill label="Standard module" tone="success-base" /> : null}
                  <DevButton small onClick={() => setDraftModules((current) => moveItem(current, moduleIndex, -1))} disabled={moduleIndex === 0}>Up</DevButton>
                  <DevButton small onClick={() => setDraftModules((current) => moveItem(current, moduleIndex, 1))} disabled={moduleIndex === draftModules.length - 1}>Down</DevButton>
                  <DevButton small tone="danger-base" onClick={() => setDraftModules((current) => current.filter((_, index) => index !== moduleIndex))}>Remove</DevButton>
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
                          <span style={{ display: "block", fontSize: "var(--text-body-xs)", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {owner ? `Already in ${owner.label}` : item.href}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {!bundle ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <DropdownField
                      value={pageSelections[moduleIndex] || ""}
                      onChange={(event) => setPageSelections((current) => ({ ...current, [moduleIndex]: event.target.value }))}
                      aria-label={`Add page to ${module.label}`}
                      placeholder="Choose another page"
                      options={catalog.filter((item) => !usedHrefs.has(item.href)).map((item) => ({
                        value: item.href,
                        label: item.label,
                        description: item.href,
                      }))}
                      style={{ flex: "1 1 260px" }}
                    />
                    <DevButton onClick={() => addPage(moduleIndex)} disabled={!pageSelections[moduleIndex]}>
                      Add page
                    </DevButton>
                  </div>
                ) : null}
              </SubSurface>
            );
          })}
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
            <DevButton
              onClick={copyLayout}
              disabled={saving || copyTargetIds.length === 0 || !hasSavableModules}
            >
              {saving ? "Saving" : "Save"}
            </DevButton>
            <DevButton variant="solid" onClick={closeCopyLayout} disabled={saving}>
              Close
            </DevButton>
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
