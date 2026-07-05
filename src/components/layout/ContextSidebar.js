import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isContextNavItemActive } from "@/config/workspace/manifest";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

function PreviewFlyout({ preview, isCollapsed }) {
  if (!preview) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: isCollapsed ? 64 : 272,
        top: preview.top,
        zIndex: 3700,
        minWidth: 180,
        maxWidth: 260,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--primary-hover)",
        color: "var(--onAccentText)",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
        opacity: 1,
        transform: "translateY(-50%)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: "0.85rem", lineHeight: 1.2 }}>
        {preview.label}
      </div>
      {preview.href && (
        <div
          style={{
            marginTop: 4,
            fontSize: "0.75rem",
            lineHeight: 1.25,
            opacity: 0.82,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preview.href}
        </div>
      )}
    </div>
  );
}

export default function ContextSidebar({
  workspace,
  pathname,
  pendingHref = null,
  isCollapsed = false,
  getNavHref = (href) => href,
  onNavigate,
  onBack,
  navLinkProps,
  renderNavContent,
  renderSectionDivider,
}) {
  const groups = useMemo(
    () =>
      workspace?.groups?.length
        ? workspace.groups
        : [{
            key: `${workspace?.department || "workspace"}-pages`,
            label: workspace?.label || "Workspace",
            collapsible: false,
            defaultOpen: true,
            items: workspace?.items || [],
          }],
    [workspace]
  );
  const storageKey = `hnp.workspaceNavigation.groups.${workspace?.department || "workspace"}`;
  const [openGroups, setOpenGroups] = useState(() =>
    groups.reduce((acc, group) => {
      acc[group.key] = group.defaultOpen !== false;
      return acc;
    }, {})
  );
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setOpenGroups(groups.reduce((acc, group) => {
        acc[group.key] = group.defaultOpen !== false;
        return acc;
      }, {}));
      return;
    }
    try {
      const saved = JSON.parse(raw);
      setOpenGroups(groups.reduce((acc, group) => {
        acc[group.key] =
          typeof saved?.[group.key] === "boolean"
            ? saved[group.key]
            : group.defaultOpen !== false;
        return acc;
      }, {}));
    } catch {
      setOpenGroups(groups.reduce((acc, group) => {
        acc[group.key] = group.defaultOpen !== false;
        return acc;
      }, {}));
    }
  }, [groups, storageKey]);

  const activeGroupKeys = useMemo(() => {
    const keys = new Set();
    for (const group of groups) {
      if ((group.items || []).some((item) => isContextNavItemActive(item, pathname, pendingHref))) {
        keys.add(group.key);
      }
    }
    return keys;
  }, [groups, pathname, pendingHref]);

  useEffect(() => {
    if (activeGroupKeys.size === 0) return;
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const key of activeGroupKeys) {
        if (!next[key]) {
          next[key] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [activeGroupKeys]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => {
      const next = { ...current, [groupKey]: !current[groupKey] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const showPreview = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPreview({
      label: item.label,
      href: item.href || null,
      top: rect.top + rect.height / 2,
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && typeof onBack === "function") {
      event.preventDefault();
      onBack();
    }
  };

  if (!workspace?.items?.length) return null;

  return (
    <DevLayoutSection
      sectionKey="workspace-context-sidebar"
      parentKey="app-sidebar-body"
      sectionType="navigation"
      backgroundToken="workspace-context-sidebar"
      onKeyDown={handleKeyDown}
      style={{
        display: "contents",
      }}
    >
      {isCollapsed ? (
        <>
          {renderSectionDivider("divider-workspace-context", { marginTop: "16px", marginBottom: "10px" })}
          <button
            className="app-btn app-btn--secondary app-btn--nav"
            type="button"
            onClick={onBack}
            onMouseEnter={(event) => showPreview(event, { label: "Back to Departments" })}
            onFocus={(event) => showPreview(event, { label: "Back to Departments" })}
            onMouseLeave={() => setPreview(null)}
            onBlur={() => setPreview(null)}
            {...navLinkProps("Back to departments")}
          >
            {renderNavContent("Departments", null, false)}
          </button>
        </>
      ) : (
        <div style={{ marginTop: "16px", marginBottom: "10px" }}>
          <button
            className="app-btn app-btn--secondary app-btn--nav"
            type="button"
            onClick={onBack}
            style={{
              width: "100%",
              marginBottom: "10px",
              justifyContent: "flex-start",
            }}
          >
            Back to departments
          </button>
          <div className="app-sidebar__section-title" style={{ marginBottom: "8px" }}>
            {workspace.label}
          </div>
        </div>
      )}

      {groups.map((group) => {
        const open = openGroups[group.key] !== false || activeGroupKeys.has(group.key);
        const showHeading = !isCollapsed && groups.length > 1;
        return (
          <div key={group.key} style={{ marginTop: showHeading ? "8px" : 0 }}>
            {showHeading && (
              group.collapsible ? (
                <button
                  type="button"
                  className="app-btn app-btn--ghost app-btn--xs"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>{group.label}</span>
                  <span aria-hidden="true">{open ? "-" : "+"}</span>
                </button>
              ) : (
                <div className="app-sidebar__section-title" style={{ marginBottom: "8px" }}>
                  {group.label}
                </div>
              )
            )}
            {open && (group.items || []).map((item) => {
              const active = isContextNavItemActive(item, pathname, pendingHref);
              return (
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${active ? " is-active" : ""}`}
                  key={item.href}
                  href={getNavHref(item.href)}
                  onClick={() => onNavigate?.(item.href)}
                  onMouseEnter={(event) => showPreview(event, item)}
                  onFocus={(event) => showPreview(event, item)}
                  onMouseLeave={() => setPreview(null)}
                  onBlur={() => setPreview(null)}
                  aria-current={active ? "page" : undefined}
                  {...navLinkProps(item.label)}
                >
                  {renderNavContent(item.label, item.href, active)}
                </Link>
              );
            })}
          </div>
        );
      })}
      <PreviewFlyout preview={preview} isCollapsed={isCollapsed} />
    </DevLayoutSection>
  );
}
