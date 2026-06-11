// file location: src/components/layout/sidebarNavIcons.js
// Inline SVG icon set for the collapsed (44px) staff navigation rail.
//
// One distinct, simple line-glyph per sidebar button label. Icons are authored
// as stroke="currentColor" so the caller controls the colour — the collapsed
// rail wraps them in a span coloured with var(--theme) (per design request).
// Backgrounds are transparent; nothing here paints a fill behind the glyph.
//
// getSidebarNavIcon(label) returns the matching glyph, or a deterministic
// first-letter fallback for any label not explicitly mapped (keeps every button
// iconned even if a new nav item is added before its glyph is drawn).
import React from "react";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false" {...STROKE}>
      {children}
    </svg>
  );
}

// Exact-label → glyph map. Every glyph is visually distinct from the others.
const ICONS = {
  // ---- Dashboard shortcuts -------------------------------------------------
  "Workshop Dashboard": (
    <Svg>
      <path d="M15 4a4 4 0 0 0-3.5 6L4 17.5V20h2.5l7.5-7.5A4 4 0 0 0 15 4z" />
    </Svg>
  ),
  "Tech Dashboard": (
    <Svg>
      <path d="M3.5 18a9 9 0 1 1 17 0" />
      <path d="M12 14l4-3.5" />
    </Svg>
  ),
  "Mobile Tech Dashboard": (
    <Svg>
      <rect x="2.5" y="7" width="12" height="9" rx="1" />
      <path d="M14.5 10h3l3 3v3h-6z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </Svg>
  ),
  "Service Dashboard": (
    <Svg>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13.5" width="3.5" height="6" rx="1.2" />
      <rect x="18" y="13.5" width="3.5" height="6" rx="1.2" />
    </Svg>
  ),
  "Managers Dashboard": (
    <Svg>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="5" />
      <line x1="18" y1="20" x2="18" y2="9" />
    </Svg>
  ),
  "Parts Dashboard": (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Svg>
  ),
  "Parts Manager Dashboard": (
    <Svg>
      <rect x="3" y="3.5" width="8" height="8" rx="1" />
      <rect x="13" y="3.5" width="8" height="8" rx="1" />
      <rect x="8" y="13" width="8" height="8" rx="1" />
    </Svg>
  ),
  "MOT Dashboard": (
    <Svg>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 3.5h6v2.5H9z" />
      <path d="M9 13l2 2 4-4" />
    </Svg>
  ),
  "Valeting Dashboard": (
    <Svg>
      <path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10z" />
    </Svg>
  ),
  "Painting Dashboard": (
    <Svg>
      <rect x="4" y="4" width="11" height="5" rx="1" />
      <path d="M15 6.5h3a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1h-6v3" />
      <rect x="10" y="15" width="4" height="6" rx="1" />
    </Svg>
  ),
  "Accounts Dashboard": (
    <Svg>
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </Svg>
  ),
  "Admin Dashboard": (
    <Svg>
      <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
    </Svg>
  ),

  // ---- General -------------------------------------------------------------
  "News Feed": (
    <Svg>
      <rect x="3" y="4" width="14" height="16" rx="1.5" />
      <path d="M17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" />
      <line x1="6" y1="8" x2="14" y2="8" />
      <line x1="6" y1="12" x2="14" y2="12" />
      <line x1="6" y1="16" x2="11" y2="16" />
    </Svg>
  ),
  Messages: (
    <Svg>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </Svg>
  ),
  Tracker: (
    <Svg>
      <path d="M12 21s-6.5-5.2-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.8 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </Svg>
  ),
  "Archive Job": (
    <Svg>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </Svg>
  ),

  // ---- Departments ---------------------------------------------------------
  "Next Jobs": (
    <Svg>
      <polygon points="5 5 13 12 5 19" />
      <line x1="17" y1="5" x2="17" y2="19" />
    </Svg>
  ),
  "Job Cards": (
    <Svg>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </Svg>
  ),
  "User Admin": (
    <Svg>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="18" cy="16.5" r="2.3" />
      <path d="M18 13v-1.2M18 21.2V20M14.9 16.5h1.2M19.9 16.5h1.2" />
    </Svg>
  ),
  Compliance: (
    <Svg>
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M5 6h14" />
      <path d="M5 6l-2.5 5h5z" />
      <path d="M19 6l-2.5 5h5z" />
      <path d="M8 21h8" />
    </Svg>
  ),
  "HR Manager": (
    <Svg>
      <circle cx="8" cy="8" r="2.6" />
      <circle cx="16" cy="8.5" r="2.2" />
      <path d="M3 19a5 5 0 0 1 10 0" />
      <path d="M13 19a4.5 4.5 0 0 1 8-2.4" />
    </Svg>
  ),
  "Website Manager": (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </Svg>
  ),
  "Website Preview": (
    <Svg>
      <path d="M2.5 12s4-7 9.5-7 9.5 7 9.5 7-4 7-9.5 7S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  ),
  "Website Shop": (
    <Svg>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </Svg>
  ),
  "Public Shop (live)": (
    <Svg>
      <path d="M4 9l1.2-4h13.6L20 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <rect x="10" y="14" width="4" height="6" />
    </Svg>
  ),
  "Goods In": (
    <Svg>
      <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
      <polyline points="8 10 12 14 16 10" />
      <line x1="12" y1="3" x2="12" y2="14" />
    </Svg>
  ),
  "New Job": (
    <Svg>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <line x1="12" y1="12" x2="12" y2="18" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </Svg>
  ),
  "Mobile Appointments": (
    <Svg>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Svg>
  ),
  Clocking: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  ),
  "Consumables Tracker": (
    <Svg>
      <path d="M9 3h6" />
      <path d="M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </Svg>
  ),
  "My Jobs": (
    <Svg>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </Svg>
  ),
  "Request Consumables": (
    <Svg>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 3.5h6v2.5H9z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </Svg>
  ),
  Efficiency: (
    <Svg>
      <polygon points="13 2 4 14 11 14 10 22 19 9 12 9 13 2" />
    </Svg>
  ),
  "Request Parts": (
    <Svg>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M2.5 4h2l2.2 11a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6" />
      <path d="M16 4v4M14 6h4" />
    </Svg>
  ),
  "New Mobile Job": (
    <Svg>
      <path d="M11 21s-6-5-6-10a6 6 0 0 1 12 0c0 5-6 10-6 10z" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </Svg>
  ),
  "Stock Catalogue": (
    <Svg>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
      <line x1="9" y1="7" x2="15" y2="7" />
    </Svg>
  ),
  Deliveries: (
    <Svg>
      <path d="M12 3l8 4v10l-8 4-8-4V7z" />
      <polyline points="4 7 12 11 20 7" />
      <line x1="12" y1="11" x2="12" y2="21" />
    </Svg>
  ),
  "Valet Jobs": (
    <Svg>
      <path d="M5 16l1.4-5a2 2 0 0 1 1.9-1.4h7.4a2 2 0 0 1 1.9 1.4L19 16" />
      <rect x="3.5" y="16" width="17" height="3.5" rx="1.2" />
      <circle cx="7.5" cy="19.5" r="1.2" />
      <circle cx="16.5" cy="19.5" r="1.2" />
    </Svg>
  ),
  Payslips: (
    <Svg>
      <path d="M5 3h14v18l-2.3-1.3L14.3 21 12 19.7 9.7 21 7.3 19.7 5 21z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="13" y2="12" />
    </Svg>
  ),

  // ---- Account -------------------------------------------------------------
  Profile: (
    <Svg>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  ),

  // ---- Accounts extra sections (StaffLayout serviceSidebarSections) --------
  Accounts: (
    <Svg>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.3" />
    </Svg>
  ),
  "Company Accounts": (
    <Svg>
      <path d="M3 9l9-5 9 5" />
      <line x1="5" y1="9" x2="5" y2="19" />
      <line x1="9.5" y1="9" x2="9.5" y2="19" />
      <line x1="14.5" y1="9" x2="14.5" y2="19" />
      <line x1="19" y1="9" x2="19" y2="19" />
      <line x1="3" y1="20.5" x2="21" y2="20.5" />
    </Svg>
  ),
  Invoices: (
    <Svg>
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </Svg>
  ),
  Reports: (
    <Svg>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M12 3v9h9" />
    </Svg>
  ),
};

function FallbackIcon({ label }) {
  const ch = ((label || "?").trim().charAt(0) || "?").toUpperCase();
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        {ch}
      </text>
    </svg>
  );
}

export function getSidebarNavIcon(label) {
  return ICONS[label] || <FallbackIcon label={label} />;
}
