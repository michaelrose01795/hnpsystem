// file location: src/components/sidebar-access/SidebarGroupAccessModal.js
// Shared staff-styled sidebar-group assignment and per-user button access popup.

import React, { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import InputField from "@/components/ui/InputField";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { StaffAlert, StaffModal } from "@/components/ui/StaffShowcasePrimitives";

const displayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  user?.name ||
  user?.email ||
  "Unnamed user";

export default function SidebarGroupAccessModal({
  open,
  group,
  users = [],
  userItemAccess = {},
  onUserItemAccessChange,
  itemOrder = [],
  onItemOrderChange,
  onClose,
  onSave,
  saving = false,
  error = "",
  readOnly = false,
  usersLoading = false,
  usersError = "",
  saveBlocked = false,
}) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [userToAdd, setUserToAdd] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [expandedUserIds, setExpandedUserIds] = useState(() => new Set());
  const itemsByHref = useMemo(
    () => new Map((group?.items || []).map((item) => [item.href, item])),
    [group]
  );
  const orderedItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const href of itemOrder) {
      const item = itemsByHref.get(href);
      if (item && !seen.has(href)) {
        seen.add(href);
        items.push(item);
      }
    }
    for (const item of group?.items || []) {
      if (!seen.has(item.href)) items.push(item);
    }
    return items;
  }, [group, itemOrder, itemsByHref]);
  const moduleByHref = useMemo(() => new Map(
    (group?.modules || []).flatMap((module) => (module.items || []).map((item) => [item.href, module.label]))
  ), [group]);
  const assignedIds = useMemo(
    () => new Set(Object.keys(userItemAccess).map(String)),
    [userItemAccess]
  );
  const availableUsers = useMemo(
    () => users
      .filter((user) => !assignedIds.has(String(user.id)))
      .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [assignedIds, users]
  );
  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return users
      .filter((user) => {
        if (!term) return true;
        return [displayName(user), user.email, user.role]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const aSelected = (userItemAccess[a.id] || userItemAccess[String(a.id)] || []).length > 0;
        const bSelected = (userItemAccess[b.id] || userItemAccess[String(b.id)] || []).length > 0;
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return displayName(a).localeCompare(displayName(b));
      });
  }, [userItemAccess, userSearch, users]);

  useEffect(() => {
    if (!open) return;
    setUserSearch("");
    setShowAddUser(false);
    setUserToAdd("");
    setExpandedUserIds(new Set());
  }, [group?.department, open]);

  const setAccess = (next) => onUserItemAccessChange?.(next);
  const assignAllItems = (userId) => {
    setAccess({ ...userItemAccess, [userId]: orderedItems.map((item) => item.href) });
  };
  const addUser = () => {
    const user = users.find((candidate) => String(candidate.id) === String(userToAdd));
    if (!user) return;
    assignAllItems(user.id);
    setUserToAdd("");
    setShowAddUser(false);
  };
  const removeUser = (userId) => {
    const next = { ...userItemAccess };
    delete next[userId];
    delete next[String(userId)];
    setAccess(next);
  };
  const toggleUserItem = (userId, href) => {
    const current = new Set(userItemAccess[userId] || userItemAccess[String(userId)] || []);
    if (current.has(href)) current.delete(href);
    else current.add(href);
    setAccess({ ...userItemAccess, [userId]: [...current] });
  };
  const toggleUserExpanded = (userId) => {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      const key = String(userId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const moveItem = (href, direction) => {
    const currentIndex = orderedItems.findIndex((item) => item.href === href);
    if (currentIndex < 0) return;
    const kind = orderedItems[currentIndex].kind;
    const sameKind = orderedItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.kind === kind);
    const kindIndex = sameKind.findIndex(({ item }) => item.href === href);
    const target = sameKind[kindIndex + direction];
    if (!target) return;
    const next = orderedItems.map((item) => item.href);
    [next[currentIndex], next[target.index]] = [next[target.index], next[currentIndex]];
    onItemOrderChange?.(next);
  };
  const renderOrderSection = (kind, title) => {
    const sectionItems = orderedItems.filter((item) => item.kind === kind);
    if (sectionItems.length === 0) return null;
    return (
      <LayerSurface gap="8px">
        <strong>{title}</strong>
        {sectionItems.map((item, index) => (
          <div
            key={item.href}
            className="app-summary-section"
            style={{ alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
          >
            <span style={{ minWidth: 0 }}>{item.label}</span>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <Button type="button" size="sm" variant="ghost" disabled={readOnly || index === 0} onClick={() => moveItem(item.href, -1)}>
                Up
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={readOnly || index === sectionItems.length - 1} onClick={() => moveItem(item.href, 1)}>
                Down
              </Button>
            </div>
          </div>
        ))}
      </LayerSurface>
    );
  };

  return (
    <StaffModal
      open={open}
      title={group ? `${group.label} access` : "Sidebar group access"}
      size="lg"
      onClose={saving ? undefined : onClose}
      headerActions={!readOnly ? (
          <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={saving || usersLoading || Boolean(usersError) || saveBlocked}>
            {saving ? "Saving..." : "Save access"}
          </Button>
      ) : null}
    >
      {error ? <StaffAlert tone="danger" title="Access cannot be saved">{error}</StaffAlert> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--page-stack-gap)", alignItems: "stretch" }}>
        <LayerTheme gap="10px" style={{ height: "100%", minHeight: 0 }}>
          <strong>Assigned users</strong>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <InputField
              id="sidebar-access-user-search"
              type="search"
              placeholder="Search users"
              aria-label="Search staff users"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              style={{ flex: "1 1 auto", minWidth: 0 }}
            />
            {!readOnly ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => setShowAddUser((current) => !current)}
                  disabled={usersLoading || Boolean(usersError) || availableUsers.length === 0}
                  aria-expanded={showAddUser}
                >
                  + Add user
                </Button>
            ) : null}
          </div>

          {usersLoading ? <p className="app-field-hint">Loading user directory...</p> : null}
          {usersError ? <StaffAlert tone="danger" title="User directory unavailable">{usersError}</StaffAlert> : null}
          {showAddUser && !readOnly ? (
            <LayerSurface gap="8px">
              <DropdownField
                id="sidebar-access-add-user"
                label="Select a staff user"
                placeholder="Choose a user"
                searchable
                value={userToAdd}
                onChange={(event) => setUserToAdd(event.target.value)}
                options={availableUsers.map((user) => ({
                  value: String(user.id),
                  label: displayName(user),
                }))}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="button" variant="secondary" onClick={addUser} disabled={!userToAdd}>Add</Button>
              </div>
            </LayerSurface>
          ) : null}
          {!usersLoading && !usersError && users.length === 0 ? (
            <p className="app-field-hint">No staff users are available.</p>
          ) : null}
          {!usersLoading && !usersError && users.length > 0 && visibleUsers.length === 0 ? (
            <p className="app-field-hint">No staff users match this search.</p>
          ) : null}

          <div
            style={{
              display: "flex",
              flex: "1 1 0",
              flexDirection: "column",
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            {visibleUsers.map((user, index) => {
              const selectedItems = new Set(userItemAccess[user.id] || userItemAccess[String(user.id)] || []);
              const isAssigned = assignedIds.has(String(user.id));
              const isExpanded = expandedUserIds.has(String(user.id));
              return (
                <div
                  key={user.id}
                  style={{
                    flexShrink: 0,
                    marginInline: "8px",
                    ...(index < visibleUsers.length - 1
                      ? { borderBottom: "var(--separating-line)" }
                      : {}),
                  }}
                >
                  <button
                    type="button"
                    className="app-btn app-btn--nav"
                    aria-expanded={isExpanded}
                    aria-controls={`sidebar-access-user-${user.id}`}
                    onClick={() => toggleUserExpanded(user.id)}
                    style={{ background: "transparent", color: "var(--text-1)", marginBottom: 0 }}
                  >
                    {displayName(user)} - {isAssigned
                      ? `${selectedItems.size} of ${orderedItems.length}`
                      : "Not assigned"}
                  </button>
                  {isExpanded ? (
                  <LayerSurface id={`sidebar-access-user-${user.id}`} gap="8px">
                    {orderedItems.map((item, itemIndex) => (
                      <React.Fragment key={`${user.id}-${item.href}`}>
                      {moduleByHref.get(item.href) && (itemIndex === 0 || moduleByHref.get(orderedItems[itemIndex - 1]?.href) !== moduleByHref.get(item.href)) ? (
                        <strong style={{ fontSize: "var(--text-body-xs)", color: "var(--accentText)" }}>{moduleByHref.get(item.href)} — inherited from group unless unchecked</strong>
                      ) : null}
                      <label key={`${user.id}-${item.href}`} style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: 44, cursor: isAssigned ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          className="app-toggle--checkbox"
                          checked={selectedItems.has(item.href)}
                          onChange={() => toggleUserItem(user.id, item.href)}
                          disabled={readOnly || !isAssigned}
                        />
                        <span>{item.label}</span>
                      </label>
                      </React.Fragment>
                    ))}
                    {isAssigned ? (
                      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={() => removeUser(user.id)}>
                        Remove user from group
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled={readOnly} onClick={() => assignAllItems(user.id)}>
                        Assign all buttons
                      </Button>
                    )}
                  </LayerSurface>
                  ) : null}
                </div>
              );
            })}
          </div>
        </LayerTheme>

        <LayerTheme gap="10px" style={{ height: "100%", minHeight: 0 }}>
          <strong>Button order</strong>
          {renderOrderSection("dashboard", "Dashboards")}
          {renderOrderSection("page", group?.label || "Pages")}
        </LayerTheme>
      </div>
    </StaffModal>
  );
}
