// file location: src/features/website/profile/ProfilePortalNav.js
//
// The seven-view portal navigation that replaced the old 27-item "Jump to"
// rail on /website/profile. It is a real tablist: the page holds the active
// view in state (mirrored into ?view= on the URL) and renders only that view's
// panel beneath, so nothing scrolls to an anchor further down a long page.
//
// It is rendered INSIDE the site top bar (2026-09): src/pages/website/profile.js
// passes it to WebsiteTopBar as the bar's middle links, where every other
// /website page passes its .ws-nav-link row. So it sticks with the bar, and
// changing view never means scrolling back up to a second navigation strip.
//
// Arrow keys, Home and End move between tabs; the customer red selected state
// and the horizontal scroll on narrow screens come from .ws-profile-tabs /
// .ws-profile-tab in custglobal.css (@family portal).

// The seven portal views, in the order they appear in the bar. The page maps
// each id to the view component it renders.
export const PORTAL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "vehicles", label: "Vehicles" },
  { id: "workshop", label: "Workshop" },
  { id: "money", label: "Money" },
  { id: "messages", label: "Messages" },
  { id: "services", label: "Services" },
  { id: "account", label: "Account" },
];

export const isPortalView = (value) => PORTAL_VIEWS.some((view) => view.id === value);

export const tabId = (view) => `ws-profile-tab-${view}`;
export const panelId = (view) => `ws-profile-panel-${view}`;

export default function ProfilePortalNav({ activeView, onSelect, counts = {} }) {
  const onKeyDown = (event) => {
    const index = PORTAL_VIEWS.findIndex((view) => view.id === activeView);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % PORTAL_VIEWS.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + PORTAL_VIEWS.length) % PORTAL_VIEWS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = PORTAL_VIEWS.length - 1;
    if (next == null) return;
    event.preventDefault();
    const target = PORTAL_VIEWS[next];
    onSelect(target.id);
    document.getElementById(tabId(target.id))?.focus();
  };

  return (
    <div
      className="ws-profile-tabs"
      role="tablist"
      aria-label="Account areas"
      data-presentation="website-profile-portal-nav"
      onKeyDown={onKeyDown}
    >
      {PORTAL_VIEWS.map((view) => {
        const selected = view.id === activeView;
        // A count is only shown when there is something waiting — an unread
        // message or an unpaid invoice — so the bar stays quiet by default.
        const count = counts[view.id];
        return (
          <button
            key={view.id}
            id={tabId(view.id)}
            type="button"
            role="tab"
            className="ws-profile-tab"
            aria-selected={selected}
            aria-controls={panelId(view.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(view.id)}
          >
            {view.label}
            {count ? <span className="ws-portal-count">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
