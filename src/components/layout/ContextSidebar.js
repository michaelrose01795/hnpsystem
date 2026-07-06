// file location: src/components/layout/ContextSidebar.js
// Workspace GROUP view (Group Sidebar). When a group is selected this component
// IS the whole sidebar body: a "Back to Groups" control at the top, the group
// name, an optional "Dashboards" section (the group's role-visible dashboards),
// then the flat list of the group's pages with active states. Each group behaves
// like its own dedicated sidebar.
//
// The only sub-heading is "Dashboards"; the pages below it stay a flat list — no
// hover previews / fly-outs, no collapsible sections, no mixed General nav.
// Styling, animations, active states, the collapsed rail and the mobile drawer
// all come from the shared nav primitives passed in by StaffSidebar.
import Link from "next/link";
import { isContextNavItemActive } from "@/config/workspace/manifest";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

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
  const items = workspace?.items || [];
  const dashboards = workspace?.dashboards || [];

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && typeof onBack === "function") {
      event.preventDefault();
      onBack();
    }
  };

  if (!items.length && !dashboards.length) return null;

  const renderNavLink = (item, keyPrefix) => {
    const active = isContextNavItemActive(item, pathname, pendingHref);
    return (
      <Link
        className={`app-btn app-btn--secondary app-btn--nav${active ? " is-active" : ""}`}
        key={`${keyPrefix}-${item.href}`}
        href={getNavHref(item.href)}
        onClick={() => onNavigate?.(item.href)}
        aria-current={active ? "page" : undefined}
        {...navLinkProps(item.label)}
      >
        {renderNavContent(item.label, item.href, active)}
      </Link>
    );
  };

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
          {renderSectionDivider("divider-workspace-context", { marginBottom: "10px" })}
          <button
            className="app-btn app-btn--secondary app-btn--nav"
            type="button"
            onClick={onBack}
            {...navLinkProps("Back to groups")}
          >
            {renderNavContent("Groups", null, false)}
          </button>
        </>
      ) : (
        <>
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
            {"‹ Back to Groups"}
          </button>
          <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
            {workspace.label}
          </div>
        </>
      )}

      {dashboards.length > 0 && (
        <>
          {isCollapsed ? (
            renderSectionDivider("divider-workspace-dashboards", { marginBottom: "10px" })
          ) : (
            <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
              Dashboards
            </div>
          )}
          {dashboards.map((item) => renderNavLink(item, "dashboard"))}
        </>
      )}

      {items.map((item) => renderNavLink(item, "page"))}
    </DevLayoutSection>
  );
}
