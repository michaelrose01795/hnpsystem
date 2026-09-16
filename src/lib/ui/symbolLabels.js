// file location: src/lib/ui/symbolLabels.js
//
// Which button labels become a symbol INSTEAD of their words.
//
// A button is either a mark or words, never both. Listing a label here means
// every <Button> in the app carrying that label renders as the bare symbol,
// with the words kept only as its accessible name — so this file decides what
// a large part of the staff UI looks like. It lives apart from the artwork in
// src/components/ui/SymbolButton.js because it is logic rather than drawing: no
// JSX, and unit-tested in symbolLabels.test.js.
//
// Keys are lower-cased, single-spaced button labels.
//
// The bar for entry is high: the mark must say the whole thing on its own, to
// someone who has never seen the button before. Two kinds of label stay as
// words:
//
//   - labels that mean nothing without context — "Cancel", "OK", "Continue",
//     "Submit", "Yes";
//   - labels whose mark would be read as a DIFFERENT action — "Reset" as the
//     same eraser as "Clear", "Decline" as a cross that reads "close",
//     "Approve" as a bare tick on an authorisation.
//
// "Export" was on that list while the only candidate mark was a download
// arrow, which reads as "Download". It has its own mark now — a record with
// the arrow leaving it — so it is mapped. "Export CSV" and "Export PDF" stay
// as words on purpose: they sit next to each other, and one shared mark would
// make them the same button.
//
// Adding a key here changes live screens. Removing one is always safe.
export const SYMBOL_FOR_LABEL = Object.freeze({
  // Record actions
  reply: "reply",
  "reply all": "reply",
  edit: "edit",
  "edit details": "edit",
  rename: "edit",
  view: "view",
  "view details": "view",
  "edit notes": "edit",
  "edit note": "edit",
  update: "update",
  "update details": "update",
  // "Remove" is a bin like "Delete". The two are the same gesture to a user;
  // whether the record is unlinked or destroyed is the confirm step's job.
  remove: "delete",
  delete: "delete",
  move: "move",
  "move media": "move",
  pin: "pin",
  unpin: "pin",
  copy: "copy",
  duplicate: "copy",
  share: "share",
  save: "save",
  "save changes": "save",
  "save and close": "save",
  "create order": "save",
  add: "add",
  "add new": "add",
  "add part": "add",
  "add parts": "add",
  "add new account": "add",
  "new account": "add",
  "new payslip": "add",
  clear: "clear",
  "clear all": "clear",
  "clear filters": "clear",
  erase: "clear",
  undo: "undo",

  // Navigation
  close: "close",
  dismiss: "close",
  next: "next",
  back: "back",
  previous: "back",
  "move up": "up",
  "move down": "down",
  open: "open",
  "open job": "open",
  "open job card": "open",
  "open job cards": "open",
  navigate: "navigate",
  directions: "navigate",
  location: "location",
  more: "more",

  // Contact
  call: "call",
  phone: "call",
  message: "message",
  "send message": "message",
  chat: "message",
  email: "email",
  "send email": "email",
  whatsapp: "whatsapp",
  send: "send",

  // Data and tools
  search: "search",
  find: "search",
  "search catalogue": "search",
  "supplier search": "search",
  export: "export",
  "export summary": "export",
  filter: "filter",
  filters: "filter",
  sort: "sort",
  refresh: "refresh",
  reload: "refresh",
  sync: "refresh",
  print: "print",
  download: "download",
  upload: "upload",
  scan: "scan",
  "scan doc": "scan",
  "scan document": "scan",
  attach: "attach",
  "attach file": "attach",
  invoice: "invoice",
  link: "link",
  schedule: "schedule",
  history: "history",

  // Meta
  help: "help",
  info: "info",
  settings: "settings",
  preferences: "settings",
  configure: "settings",
  lock: "lock",
  photo: "photo",
  "take photo": "photo",
  video: "video",
});

// Bare glyphs a call site may still be using as its mark. When one of these is
// the entire button label the glyph carries no meaning of its own, so the
// accessible name is what the button is really labelled by — and that is what
// the symbol gets resolved from.
const GLYPH_ONLY_LABELS = new Set(["x", "×", "✕", "✖", "╳", "⨯", "+", "‹", "›", "<", ">"]);

const normaliseLabel = (value) =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ").replace(/[.…:]+$/, "");

// Resolves the symbol for a button from its children and accessible name.
// Returns a symbol name, or null for "no symbol".
export function resolveSymbolForLabel(children, ariaLabel) {
  if (typeof children === "string") {
    const text = normaliseLabel(children);
    if (SYMBOL_FOR_LABEL[text]) return SYMBOL_FOR_LABEL[text];
    if (!GLYPH_ONLY_LABELS.has(text)) return null;
  } else if (children !== null && children !== undefined && typeof children !== "boolean") {
    // Mixed content (an icon the page already supplies, a fragment, a count
    // badge) is left alone — the call site has said what it wants shown.
    return null;
  }
  if (typeof ariaLabel === "string") {
    const aria = normaliseLabel(ariaLabel);
    if (SYMBOL_FOR_LABEL[aria]) return SYMBOL_FOR_LABEL[aria];
  }
  return null;
}
