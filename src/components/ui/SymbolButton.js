// file location: src/components/ui/SymbolButton.js
//
// The symbol system. One registry, one shape, one place to change.
//
// Every symbol used anywhere in the staff app is registered in SYMBOLS below
// and drawn here — never as a stray emoji, a bare character or a one-off SVG
// dropped into a page. Change a mark here and it changes in every button,
// popup header and action row that uses it.
//
// Two ways to use a symbol:
//
//   1. Icon only — <SymbolButton symbol="delete" label="Delete comment" />
//      An exact 44px circle. See src/styles/families/symbols.css.
//
//   2. Beside a label — <Button>Reply</Button>
//      Button resolves the symbol from the label through SYMBOL_FOR_LABEL, so
//      every "Reply" / "Edit" / "Delete" / "Save" button in the app picks up
//      its mark without the call site being touched. Pass symbol={false} to
//      opt out, or symbol="name" to force one.
//
// Appearance lives in the families (symbols.css for the circle, buttons.css
// for the in-button mark). This file owns only the artwork, which is why every
// symbol shares one 24-unit viewBox and paints in `currentColor`, so the circle
// or the button variant around it supplies the colour.
//
// The artwork deliberately fills most of the 24-unit grid: a symbol in a 44px
// circle should read at a glance across a workshop, not sit small in the middle.
import React from "react";
import { SYMBOL_FOR_LABEL, resolveSymbolForLabel } from "@/lib/ui/symbolLabels";

// Shared stroke geometry. Every symbol is drawn on the same 24x24 grid so a
// row of them reads as one set.
//
// Note what is NOT here: stroke-width. Weight is a stylesheet dial
// (--symbol-stroke-width in families/symbols.css), not artwork. A
// stroke-width attribute on a path would beat the inherited CSS value, so
// leaving it off is what lets one line in the stylesheet re-weight every
// symbol in the app at once.
const S = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// Solid counterpart, for the few marks that only read as a filled shape.
const F = { fill: "currentColor", stroke: "none" };

export const SYMBOLS = {
  // ── Record actions ────────────────────────────────────────
  reply: {
    label: "Reply",
    render: () => (
      <>
        <path d="M8.5 3.5 1.8 10.2 8.5 16.9" {...S} />
        <path d="M1.8 10.2H13a9 9 0 0 1 9 9v1.3" {...S} />
      </>
    ),
  },
  view: {
    label: "View",
    render: () => (
      <>
        <path d="M1.5 12S5.6 4.6 12 4.6 22.5 12 22.5 12 18.4 19.4 12 19.4 1.5 12 1.5 12Z" {...S} />
        <circle cx="12" cy="12" r="3.6" {...S} />
      </>
    ),
  },
  edit: {
    label: "Edit",
    render: () => (
      <>
        <path d="M16.4 2.6a2.55 2.55 0 0 1 3.6 3.6L9.1 17.1l-4.7 1.2 1.2-4.7Z" {...S} />
        <path d="M2.5 21.5h19" {...S} />
      </>
    ),
  },
  delete: {
    label: "Delete",
    render: () => (
      <>
        <path d="M2.5 5.5h19" {...S} />
        <path d="M8.8 5.5V3.6a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.9" {...S} />
        <path d="M4.8 5.5 6 20.2A1.9 1.9 0 0 0 7.9 22h8.2a1.9 1.9 0 0 0 1.9-1.8L19.2 5.5" {...S} />
        <path d="M9.8 9.5v8M14.2 9.5v8" {...S} />
      </>
    ),
  },
  move: {
    label: "Move",
    render: () => (
      <>
        <path d="M12 1.5v21M1.5 12h21" {...S} />
        <path d="M8.5 5 12 1.5 15.5 5M8.5 19 12 22.5 15.5 19M5 8.5 1.5 12 5 15.5M19 8.5 22.5 12 19 15.5" {...S} />
      </>
    ),
  },
  pin: {
    label: "Pin",
    render: () => (
      <>
        <path d="M9.4 2.5h5.2v6.3l3.6 3.7v2.3H5.8v-2.3l3.6-3.7Z" {...S} />
        <path d="M12 14.8v6.7" {...S} />
      </>
    ),
  },
  copy: {
    label: "Copy",
    render: () => (
      <>
        <rect x="8" y="8" width="14" height="14" rx="2.4" {...S} />
        <path d="M16 8V4.4A2.4 2.4 0 0 0 13.6 2H4.4A2.4 2.4 0 0 0 2 4.4v9.2A2.4 2.4 0 0 0 4.4 16H8" {...S} />
      </>
    ),
  },
  share: {
    label: "Share",
    render: () => (
      <>
        <circle cx="19" cy="4.5" r="2.9" {...S} />
        <circle cx="5" cy="12" r="2.9" {...S} />
        <circle cx="19" cy="19.5" r="2.9" {...S} />
        <path d="M7.6 10.6 16.4 5.9M7.6 13.4l8.8 4.7" {...S} />
      </>
    ),
  },
  open: {
    label: "Open",
    render: () => (
      <>
        <path d="M13 2.5h8.5V11" {...S} />
        <path d="M21.5 2.5 10.5 13.5" {...S} />
        <path d="M18 13.5v6a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" {...S} />
      </>
    ),
  },
  save: {
    label: "Save",
    render: () => (
      <>
        <path d="M2.5 4.5a2 2 0 0 1 2-2h11.6L21.5 7.9V19.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z" {...S} />
        <path d="M6.5 2.5v6h9v-6" {...S} />
        <rect x="6.5" y="13" width="11" height="8.5" rx="1.2" {...S} />
      </>
    ),
  },
  add: {
    label: "Add",
    render: () => (
      <>
        <path d="M12 2.5v19M2.5 12h19" {...S} />
      </>
    ),
  },
  clear: {
    label: "Clear",
    render: () => (
      <>
        <path d="M8.6 20.5 2.9 14.8a2 2 0 0 1 0-2.9l9-9a2 2 0 0 1 2.9 0l6.3 6.3a2 2 0 0 1 0 2.9l-8.4 8.4Z" {...S} />
        <path d="M7.2 8.2 15.8 16.8" {...S} />
        <path d="M8.6 20.5H21.5" {...S} />
      </>
    ),
  },
  undo: {
    label: "Undo",
    render: () => (
      <>
        <path d="M3 8.5h9.5a6.5 6.5 0 0 1 0 13H7" {...S} />
        <path d="M7 4 2.5 8.5 7 13" {...S} />
      </>
    ),
  },

  // ── Navigation ────────────────────────────────────────────
  close: {
    label: "Close",
    render: () => (
      <>
        <path d="M3.5 3.5 20.5 20.5M20.5 3.5 3.5 20.5" {...S} />
      </>
    ),
  },
  next: {
    label: "Next",
    render: () => (
      <>
        <path d="M7.5 2 17.5 12 7.5 22" {...S} />
      </>
    ),
  },
  back: {
    label: "Back",
    render: () => (
      <>
        <path d="M16.5 2 6.5 12l10 10" {...S} />
      </>
    ),
  },
  up: {
    label: "Up",
    render: () => (
      <>
        <path d="M12 21.5V3" {...S} />
        <path d="M4.8 10.2 12 3l7.2 7.2" {...S} />
      </>
    ),
  },
  down: {
    label: "Down",
    render: () => (
      <>
        <path d="M12 2.5V21" {...S} />
        <path d="M4.8 13.8 12 21l7.2-7.2" {...S} />
      </>
    ),
  },
  navigate: {
    label: "Navigate",
    render: () => (
      <>
        <path d="M21.5 2.5 2.5 10.4l8.2 2.9 2.9 8.2Z" {...S} />
      </>
    ),
  },
  location: {
    label: "Location",
    render: () => (
      <>
        <path d="M12 1.8c-4.1 0-7.4 3.3-7.4 7.4 0 5.4 7.4 12.9 7.4 12.9s7.4-7.5 7.4-12.9c0-4.1-3.3-7.4-7.4-7.4Z" {...S} />
        <circle cx="12" cy="9.2" r="2.9" {...S} />
      </>
    ),
  },
  more: {
    label: "More",
    render: () => (
      <>
        <circle cx="4" cy="12" r="2.1" {...F} />
        <circle cx="12" cy="12" r="2.1" {...F} />
        <circle cx="20" cy="12" r="2.1" {...F} />
      </>
    ),
  },

  // ── Contact ───────────────────────────────────────────────
  call: {
    label: "Call",
    render: () => (
      <>
        <path d="M21.6 17.1v3.1a1.9 1.9 0 0 1-2.1 1.9 19.4 19.4 0 0 1-8.4-3 19 19 0 0 1-5.8-5.8 19.4 19.4 0 0 1-3-8.5A1.9 1.9 0 0 1 4.2 2.8h3.1a1.9 1.9 0 0 1 1.9 1.6c.12.94.35 1.85.67 2.73a1.9 1.9 0 0 1-.43 2L8.16 10.4a15.4 15.4 0 0 0 5.44 5.44l1.27-1.27a1.9 1.9 0 0 1 2-.43c.88.32 1.79.55 2.73.67a1.9 1.9 0 0 1 1.6 1.94Z" {...S} />
      </>
    ),
  },
  message: {
    label: "Message",
    render: () => (
      <>
        <path d="M21.5 15a2.5 2.5 0 0 1-2.5 2.5H7.5L2.5 22V4.5A2.5 2.5 0 0 1 5 2h14a2.5 2.5 0 0 1 2.5 2.5Z" {...S} />
      </>
    ),
  },
  announce: {
    label: "Announce",
    render: () => (
      <>
        <path d="M2.2 9.4v5.2a1.9 1.9 0 0 0 1.9 1.9h2.5l10.2 4.6V2.9L6.6 7.5H4.1a1.9 1.9 0 0 0-1.9 1.9Z" {...S} />
        <path d="M6.6 16.5v3.2a2 2 0 0 0 4 0v-1.4" {...S} />
        <path d="M20.4 9.3a4.2 4.2 0 0 1 0 5.4" {...S} />
      </>
    ),
  },
  email: {
    label: "Email",
    render: () => (
      <>
        <rect x="1.8" y="4" width="20.4" height="16" rx="2.2" {...S} />
        <path d="m2.4 5.6 8.4 6.6a2 2 0 0 0 2.4 0l8.4-6.6" {...S} />
      </>
    ),
  },
  whatsapp: {
    label: "WhatsApp",
    render: () => (
      <>
        <path d="M2.2 21.8 3.6 17a9.7 9.7 0 1 1 3.6 3.5Z" {...S} />
        <path d="M8.6 8c.3-.7.6-.7 1-.7h.8c.3 0 .6 0 .8.6l.9 2c.1.3 0 .6-.2.8l-.6.7c-.2.2-.2.4-.1.6a7 7 0 0 0 3.3 3c.3.1.5 0 .7-.1l.8-.8c.2-.3.5-.3.8-.2l2 1c.3.2.4.4.4.7 0 1.2-1 2.2-2.2 2.2A9.4 9.4 0 0 1 8.4 9.7 1.9 1.9 0 0 1 8.6 8Z" {...S} />
      </>
    ),
  },
  send: {
    label: "Send",
    render: () => (
      <>
        <path d="M22 2 2 9.4l8.4 3.9L22 2Z" {...S} />
        <path d="M22 2 14.3 22l-3.9-8.7L22 2Z" {...S} />
      </>
    ),
  },

  // ── Data & tools ──────────────────────────────────────────
  search: {
    label: "Search",
    render: () => (
      <>
        <circle cx="10.2" cy="10.2" r="7.7" {...S} />
        <path d="m15.9 15.9 5.8 5.8" {...S} />
      </>
    ),
  },
  filter: {
    label: "Filter",
    render: () => (
      <>
        <path d="M2 3.5h20l-7.8 9.2v7.6l-4.4 2.2v-9.8Z" {...S} />
      </>
    ),
  },
  sort: {
    label: "Sort",
    render: () => (
      <>
        <path d="M6.5 21V3M6.5 3 2.5 7M6.5 3l4 4" {...S} />
        <path d="M17.5 3v18M17.5 21l-4-4M17.5 21l4-4" {...S} />
      </>
    ),
  },
  refresh: {
    label: "Refresh",
    render: () => (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" {...S} />
        <path d="M21.5 2.5v5.2h-5.2" {...S} />
      </>
    ),
  },
  update: {
    label: "Update",
    render: () => (
      <>
        <path d="M12 16.5V2.5" {...S} />
        <path d="M6.5 8 12 2.5 17.5 8" {...S} />
        <path d="M2.5 20.5h19" {...S} />
      </>
    ),
  },
  download: {
    label: "Download",
    render: () => (
      <>
        <path d="M12 2.5v13" {...S} />
        <path d="M6.5 10 12 15.5 17.5 10" {...S} />
        <path d="M2.5 16.9v2.6a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-2.6" {...S} />
      </>
    ),
  },
  upload: {
    label: "Upload",
    render: () => (
      <>
        <path d="M12 15.5v-13" {...S} />
        <path d="M6.5 8 12 2.5 17.5 8" {...S} />
        <path d="M2.5 16.9v2.6a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-2.6" {...S} />
      </>
    ),
  },
  export: {
    label: "Export",
    render: () => (
      <>
        <path d="M13.5 21.5h-9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h9" {...S} />
        <path d="M9.5 12h12" {...S} />
        <path d="M17 7.5 21.5 12 17 16.5" {...S} />
      </>
    ),
  },
  print: {
    label: "Print",
    render: () => (
      <>
        <path d="M6.5 8.5v-6h11v6" {...S} />
        <path d="M6.5 17.5h-2a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" {...S} />
        <rect x="6.5" y="14" width="11" height="7.5" rx="1.2" {...S} />
      </>
    ),
  },
  scan: {
    label: "Scan",
    render: () => (
      <>
        <path d="M2.5 8V4.5a2 2 0 0 1 2-2H8M16 2.5h3.5a2 2 0 0 1 2 2V8M21.5 16v3.5a2 2 0 0 1-2 2H16M8 21.5H4.5a2 2 0 0 1-2-2V16" {...S} />
        <path d="M2.5 12h19" {...S} />
      </>
    ),
  },
  document: {
    label: "Document",
    render: () => (
      <>
        <path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5Z" {...S} />
        <path d="M14 2.5v6h6" {...S} />
        <path d="M8 13h8M8 17h6" {...S} />
      </>
    ),
  },
  invoice: {
    label: "Invoice",
    // A receipt, not the plain document: the torn bottom edge is what tells
    // the two apart at button size, since both are otherwise a page of lines.
    render: () => (
      <>
        <path d="M4 2.5h16v19l-2.7-1.8-2.65 1.8-2.65-1.8-2.65 1.8L6.7 19.7 4 21.5Z" {...S} />
        <path d="M8 8.2h8M8 12h8M8 15.8h4.5" {...S} />
      </>
    ),
  },
  details: {
    label: "Details",
    render: () => (
      <>
        <path d="M8.5 6.5h13M8.5 12h13M8.5 17.5h13" {...S} />
        <circle cx="3.6" cy="6.5" r="1.6" {...F} />
        <circle cx="3.6" cy="12" r="1.6" {...F} />
        <circle cx="3.6" cy="17.5" r="1.6" {...F} />
      </>
    ),
  },
  note: {
    label: "Note",
    render: () => (
      <>
        <path d="M21.5 4.5v9L13.5 21.5h-9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2Z" {...S} />
        <path d="M21.5 13.5h-6a2 2 0 0 0-2 2v6" {...S} />
      </>
    ),
  },
  link: {
    label: "Link",
    render: () => (
      <>
        <path d="M10 13.6a4.7 4.7 0 0 0 7.1.5l3-3a4.7 4.7 0 0 0-6.7-6.7l-1.7 1.7" {...S} />
        <path d="M14 10.4a4.7 4.7 0 0 0-7.1-.5l-3 3a4.7 4.7 0 0 0 6.7 6.7l1.7-1.7" {...S} />
      </>
    ),
  },
  attach: {
    label: "Attach",
    render: () => (
      <>
        <path d="M20.4 11.4 11.6 20.2a5.5 5.5 0 0 1-7.8-7.8l9.1-9.1a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3" {...S} />
      </>
    ),
  },
  schedule: {
    label: "Schedule",
    render: () => (
      <>
        <rect x="2.5" y="4.5" width="19" height="17" rx="2.2" {...S} />
        <path d="M2.5 9.5h19M7.5 2.5v4M16.5 2.5v4" {...S} />
      </>
    ),
  },
  history: {
    label: "History",
    render: () => (
      <>
        <path d="M2.6 10.6A9.5 9.5 0 1 1 4 16.4" {...S} />
        <path d="M2.5 3.5v6h6" {...S} />
        <path d="M12 7v5.4l3.6 2.2" {...S} />
      </>
    ),
  },

  // ── Status & meta ─────────────────────────────────────────
  approve: {
    label: "Approve",
    render: () => (
      <>
        <path d="M2.5 12.8 8.8 19 21.5 5.5" {...S} />
      </>
    ),
  },
  decline: {
    label: "Decline",
    render: () => (
      <>
        <circle cx="12" cy="12" r="9.5" {...S} />
        <path d="M8.2 8.2 15.8 15.8M15.8 8.2 8.2 15.8" {...S} />
      </>
    ),
  },
  help: {
    label: "Help",
    render: () => (
      <>
        <circle cx="12" cy="12" r="9.7" {...S} />
        <path d="M9.1 9.1a3 3 0 0 1 5.8 1c0 2-3 3-3 3" {...S} />
        <circle cx="12" cy="17.2" r="1.25" {...F} />
      </>
    ),
  },
  info: {
    label: "Info",
    render: () => (
      <>
        <circle cx="12" cy="12" r="9.7" {...S} />
        <path d="M12 11v6" {...S} />
        <circle cx="12" cy="7.2" r="1.25" {...F} />
      </>
    ),
  },
  settings: {
    label: "Settings",
    // A cog, not a sun. The eight-spoke version this replaced read as a
    // brightness control at button size, because bare radial lines around a
    // circle are exactly what a brightness mark is. Teeth (tip radius 10.7,
    // root 7.6) give it the flat-topped silhouette that says "settings".
    render: () => (
      <>
        <path d="M9.78 4.73L10.14 1.46A10.7 10.7 0 0 1 13.86 1.46L14.22 4.73A7.6 7.6 0 0 1 15.57 5.29L18.14 3.24A10.7 10.7 0 0 1 20.76 5.86L18.71 8.43A7.6 7.6 0 0 1 19.27 9.78L22.54 10.14A10.7 10.7 0 0 1 22.54 13.86L19.27 14.22A7.6 7.6 0 0 1 18.71 15.57L20.76 18.14A10.7 10.7 0 0 1 18.14 20.76L15.57 18.71A7.6 7.6 0 0 1 14.22 19.27L13.86 22.54A10.7 10.7 0 0 1 10.14 22.54L9.78 19.27A7.6 7.6 0 0 1 8.43 18.71L5.86 20.76A10.7 10.7 0 0 1 3.24 18.14L5.29 15.57A7.6 7.6 0 0 1 4.73 14.22L1.46 13.86A10.7 10.7 0 0 1 1.46 10.14L4.73 9.78A7.6 7.6 0 0 1 5.29 8.43L3.24 5.86A10.7 10.7 0 0 1 5.86 3.24L8.43 5.29A7.6 7.6 0 0 1 9.78 4.73Z" {...S} />
        <circle cx="12" cy="12" r="3.5" {...S} />
      </>
    ),
  },
  lock: {
    label: "Lock",
    render: () => (
      <>
        <rect x="3.5" y="10" width="17" height="11.5" rx="2.2" {...S} />
        <path d="M7.2 10V6.9a4.8 4.8 0 0 1 9.6 0V10" {...S} />
      </>
    ),
  },
  user: {
    label: "User",
    render: () => (
      <>
        <circle cx="12" cy="7.4" r="4.9" {...S} />
        <path d="M2.8 21.5a9.2 9.2 0 0 1 18.4 0" {...S} />
      </>
    ),
  },
  photo: {
    label: "Photo",
    render: () => (
      <>
        <path d="M21.5 19a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h5l2 3h3a2 2 0 0 1 2 2Z" {...S} />
        <circle cx="12" cy="13" r="4.2" {...S} />
      </>
    ),
  },
  video: {
    label: "Video",
    render: () => (
      <>
        <rect x="1.8" y="5" width="14.4" height="14" rx="2.2" {...S} />
        <path d="m16.2 12 6-4.4v8.8Z" {...S} />
      </>
    ),
  },
};

export const SYMBOL_NAMES = Object.keys(SYMBOLS);

// The label-to-symbol rule lives in lib/ui/symbolLabels.js — it is logic, not
// artwork, and is unit-tested there. Re-exported so a consumer that already has
// SymbolButton in hand does not need a second import.
export { SYMBOL_FOR_LABEL, resolveSymbolForLabel };

// Every symbol the label map points at must actually be drawn above; a typo in
// either place would silently drop the mark from a whole class of buttons.
if (process.env.NODE_ENV !== "production") {
  const undrawn = [...new Set(Object.values(SYMBOL_FOR_LABEL))].filter((name) => !SYMBOLS[name]);
  if (undrawn.length && typeof console !== "undefined") {
    console.warn(
      `[SymbolButton] SYMBOL_FOR_LABEL points at symbol(s) with no artwork: ${undrawn.join(", ")}.`
    );
  }
}

// The mark on its own, without the circle — used by Button to sit a symbol
// beside a label. Prefer <SymbolButton> for a standalone icon action.
export function Symbol({ symbol, className = "app-symbol-btn__glyph" }) {
  const entry = SYMBOLS[symbol];
  if (!entry) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {entry.render()}
    </svg>
  );
}

export default function SymbolButton({
  symbol,
  label,
  className = "",
  type = "button",
  ...rest
}) {
  const entry = SYMBOLS[symbol];
  if (!entry) {
    if (process.env.NODE_ENV !== "production" && typeof console !== "undefined") {
      console.warn(
        `[SymbolButton] Unknown symbol "${symbol}". Add it to SYMBOLS in ` +
        `src/components/ui/SymbolButton.js rather than inlining an icon.`
      );
    }
    return null;
  }

  const accessibleName = label || entry.label;
  // One fill for every symbol — there is no tone axis. See families/symbols.css.
  const classes = ["app-symbol-btn", className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      data-symbol={symbol}
      aria-label={accessibleName}
      title={accessibleName}
      {...rest}
    >
      <Symbol symbol={symbol} />
    </button>
  );
}
