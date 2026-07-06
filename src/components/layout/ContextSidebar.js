// file location: src/components/layout/ContextSidebar.js
// Workspace GROUP view (Phase 8 — Group Sidebar). When a group is selected this
// component IS the whole sidebar body: a "Back to Groups" control at the top,
// the group name, then a simple flat list of the group's pages with active
// states. Each group behaves like its own dedicated sidebar.
//
// Deliberately simple — no hover previews / fly-outs, no sub-group headings, no
// collapsible sections, and no mixed General navigation. Styling, animations,
// active states, the collapsed rail and the mobile drawer all come from the
// shared nav primitives passed in by StaffSidebar.
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

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && typeof onBack === "function") {
      event.preventDefault();
      onBack();
    }
  };

  if (!items.length) return null;

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

      {items.map((item) => {
        const active = isContextNavItemActive(item, pathname, pendingHref);
        return (
          <Link
            className={`app-btn app-btn--secondary app-btn--nav${active ? " is-active" : ""}`}
            key={item.href}
            href={getNavHref(item.href)}
            onClick={() => onNavigate?.(item.href)}
            aria-current={active ? "page" : undefined}
            {...navLinkProps(item.label)}
          >
            {renderNavContent(item.label, item.href, active)}
          </Link>
        );
      })}
    </DevLayoutSection>
  );
}
