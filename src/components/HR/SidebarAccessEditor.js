// file location: src/components/HR/SidebarAccessEditor.js
// Per-employee sidebar-access editor (HR → Employees). Lets an admin control
// exactly which sidebar items a user has: "if it's ticked, they have access."
//
// Model (see docs / manifest.resolveAccessiblePaths):
//   • value === null  → no override; the user follows their ROLE's default nav.
//                       The checklist shows the role defaults pre-ticked.
//   • value === { items } → an explicit snapshot; that list is authoritative.
// Toggling any item materialises the current effective set into an explicit
// snapshot (role defaults + the change). "Reset to role defaults" clears the
// override back to null.
//
// The item universe is the manifest's classic sidebar items (getAllSidebarItems).
// Account items (Profile) are always-on invariants and render locked.

import React, { useMemo, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import SidebarGroupAccessModal from "@/components/sidebar-access/SidebarGroupAccessModal";
import {
  getAccessibleNavPaths,
  getAllSidebarItems,
  getKnownSidebarHrefs,
  getWorkspaceGroupRoles,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";
import {
  applySidebarGroupChange,
  applySidebarGroupUserSelection,
  isSidebarGroupEnabled,
  materializeSidebarAccess,
} from "@/lib/sidebarAccess";

export default function SidebarAccessEditor({ role, value, onChange }) {
  const groups = useMemo(() => getAllSidebarItems(), []);
  const [managedGroupKey, setManagedGroupKey] = useState(null);
  const [draftUserAccess, setDraftUserAccess] = useState({});
  const [draftOrder, setDraftOrder] = useState([]);

  // The hrefs this role would get by default (intersected with the toggleable
  // universe) — the seed shown when there is no explicit override.
  const roleDefaults = useMemo(() => {
    const universe = getKnownSidebarHrefs();
    const accessible = getAccessibleNavPaths(role ? [role] : []);
    return new Set([...accessible].filter((href) => universe.has(href)));
  }, [role]);

  const hasOverride = Boolean(value && Array.isArray(value.items));
  // The currently-effective set of enabled hrefs.
  const checked = useMemo(
    () => (hasOverride
      ? new Set([...resolveAccessiblePaths(role ? [role] : [], value)].filter((href) => getKnownSidebarHrefs().has(href)))
      : roleDefaults),
    [hasOverride, role, value, roleDefaults]
  );

  const totalToggleable = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          sum + (group.category === "account" ? 0 : group.items.length),
        0
      ),
    [groups]
  );
  const enabledCount = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          group.category === "account"
            ? sum
            : sum + group.items.filter((item) => checked.has(item.href)).length,
        0
      ),
    [groups, checked]
  );

  const toggle = (href) => {
    const snapshot = materializeSidebarAccess(role, value);
    const next = new Set(snapshot.items);
    if (next.has(href)) next.delete(href);
    else next.add(href);
    onChange({ ...snapshot, items: [...next] });
  };

  const setGroup = (group, enabled) => {
    onChange(applySidebarGroupChange({
      role,
      currentValue: value,
      groupKey: group.department,
      enabled,
      itemOrder: group.items.map((item) => item.href),
    }));
  };

  const managedGroup = groups.find((group) => group.department === managedGroupKey) || null;
  const openGroupManager = (group) => {
    const snapshot = materializeSidebarAccess(role, value);
    setManagedGroupKey(group.department);
    const groupHrefs = new Set(group.items.map((item) => item.href));
    setDraftUserAccess(
      isSidebarGroupEnabled(role, value, group.department)
        ? { employee: value
          ? snapshot.items.filter((href) => groupHrefs.has(href))
          : group.items.map((item) => item.href) }
        : {}
    );
    setDraftOrder(
      snapshot.itemOrder?.[group.department] || group.items.map((item) => item.href)
    );
  };

  const saveManagedGroup = () => {
    if (!managedGroup) return;
    onChange(applySidebarGroupUserSelection({
      role,
      currentValue: value,
      groupKey: managedGroup.department,
      enabled: Boolean(draftUserAccess.employee),
      selectedItemHrefs: draftUserAccess.employee || [],
      itemOrder: draftOrder,
    }));
    setManagedGroupKey(null);
  };

  const resetToRoleDefaults = () => onChange(null);

  const mutedTextStyle = { color: "var(--text-1)", opacity: 0.65, fontSize: "0.85rem" };
  const linkButtonStyle = {
    background: "transparent",
    color: "var(--accentText)",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontSize: "0.85rem",
  };

  return (
    <LayerTheme gap="16px">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 700, color: "var(--text-1)" }}>Sidebar access</span>
          <span style={mutedTextStyle}>
            {hasOverride
              ? `Custom access — ${enabledCount} of ${totalToggleable} items enabled.`
              : "Following role defaults. Tick or untick an item to set custom access."}
          </span>
        </div>
        {hasOverride && (
          <button type="button" onClick={resetToRoleDefaults} style={linkButtonStyle}>
            Reset to role defaults
          </button>
        )}
      </div>

      {groups.map((group) => {
        const isAccount = group.category === "account";
        const groupEnabled = group.items.filter((item) => checked.has(item.href)).length;
        return (
          <LayerSurface key={group.department} gap="10px">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{group.label}</span>
              {!isAccount && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => openGroupManager(group)}
                    style={linkButtonStyle}
                  >
                    Manage
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroup(group, true)}
                    style={linkButtonStyle}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroup(group, false)}
                    style={linkButtonStyle}
                  >
                    None
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "4px",
              }}
            >
              {group.items.map((item) => {
                const isChecked = isAccount ? true : checked.has(item.href);
                return (
                  <label
                    key={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minHeight: "44px",
                      padding: "0 8px",
                      borderRadius: "var(--radius-xs)",
                      cursor: isAccount ? "default" : "pointer",
                      color: "var(--text-1)",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="app-toggle--checkbox"
                      checked={isChecked}
                      disabled={isAccount}
                      onChange={() => (isAccount ? null : toggle(item.href))}
                    />
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span>{item.label}</span>
                      {isAccount && <span style={mutedTextStyle}>Always on</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {!isAccount && (
              <span style={mutedTextStyle}>
                {groupEnabled} of {group.items.length} enabled
              </span>
            )}
          </LayerSurface>
        );
      })}

      <SidebarGroupAccessModal
        open={Boolean(managedGroup)}
        group={managedGroup}
        users={[{
          id: "employee",
          name: "This employee",
          role,
          accessSource: hasOverride ? "Custom access" : "Role default",
        }]}
        userItemAccess={draftUserAccess}
        onUserItemAccessChange={setDraftUserAccess}
        itemOrder={draftOrder}
        onItemOrderChange={setDraftOrder}
        onClose={() => setManagedGroupKey(null)}
        onSave={saveManagedGroup}
        rolesLabel={(() => {
          const roles = managedGroup ? getWorkspaceGroupRoles(managedGroup.department) : [];
          return roles === "*" ? "All authenticated users" : roles.join(", ") || "Page-role gated only";
        })()}
      />
    </LayerTheme>
  );
}
