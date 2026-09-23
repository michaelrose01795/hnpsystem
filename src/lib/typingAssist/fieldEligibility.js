// file location: src/lib/typingAssist/fieldEligibility.js
//
// Decides which focused fields the typing assistant attaches to: every text
// box, search bar and textarea in the app. Codes typed into those fields
// (registrations, VINs, part numbers, postcodes) are not flagged because the
// word tokenizer already skips anything with digits, ALL CAPS and URLs.
//
// Only fields where spelling is meaningless or unwanted are skipped:
// passwords, e-mail / phone / URL / number entry, one-time codes, card details.
// An author's spellCheck={false} does NOT opt out (the shared SearchBar sets it
// to stop the browser's own squiggle) — use the explicit attribute instead:
//
//   data-typing-assist="off"  on the field or any ancestor  -> never attach

const TEXT_INPUT_TYPES = new Set(["text", "search"]);
const EXCLUDED_AUTOCOMPLETE = /\b(username|email|tel|tel-\w+|url|one-time-code|current-password|new-password|cc-\w+)\b/i;
const EXCLUDED_INPUTMODE = /^(numeric|decimal|tel|email|url|none)$/i;
const MIN_SINGLE_LINE_WIDTH = 60; // px — too narrow to show an underline at all

// "multiline" | "single" | "rich" | null
export function typingAssistModeFor(el) {
  if (!el || typeof el.tagName !== "string") return null;
  if (el.closest?.('[data-typing-assist="off"], [data-typing-assist-ui], [data-dev-overlay-internal]')) return null;

  // A contenteditable editor (notes widget, rich message boxes): attach to
  // the editing host only, never to an element nested inside it.
  if (el.isContentEditable) {
    return el.parentElement?.isContentEditable ? null : "rich";
  }

  const tag = el.tagName.toUpperCase();
  let mode = null;
  if (tag === "TEXTAREA") mode = "multiline";
  else if (tag === "INPUT" && TEXT_INPUT_TYPES.has((el.getAttribute("type") || "text").toLowerCase())) mode = "single";
  if (!mode) return null;

  if (el.disabled || el.readOnly || el.getAttribute("aria-hidden") === "true") return null;

  if (mode === "single") {
    if (EXCLUDED_AUTOCOMPLETE.test(el.getAttribute("autocomplete") || "")) return null;
    if (EXCLUDED_INPUTMODE.test(el.getAttribute("inputmode") || "")) return null;
    if (typeof el.getBoundingClientRect === "function" && el.getBoundingClientRect().width < MIN_SINGLE_LINE_WIDTH) {
      return null;
    }
  }
  return mode;
}
