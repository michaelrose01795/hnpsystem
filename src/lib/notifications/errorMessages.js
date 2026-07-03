// Plain-English message catalogue for the Frontend Feedback & Error System.
//
// Phase 3 (see docs/frontend-feedback-system-rollout.md §Phase 3). This is the
// single home for reusable, user-facing feedback copy so wording stays
// consistent and can later be translated (keys, not sentences, are the stable
// contract — i18n is a future concern, English only ships today).
//
// Usage: callers pass EITHER a catalogue key (ALL_CAPS) or a literal plain-
// English sentence to the report* helpers in ./report.js. resolveMessage()
// turns a known key into its friendly sentence and leaves any other string
// untouched, so migrating a call site is a drop-in — no key required.
//
// Rules (from the rollout guiding principles):
//   • Plain English first — never a raw stack, HTTP code, or DB string.
//   • One friendly sentence per situation; the technical detail lives in
//     devInfo (built by buildErrorAlert), never in the visible message.

// Error tone — something the user tried failed.
export const ERROR_MESSAGES = {
  GENERIC: "Something went wrong. Please try again.",
  SAVE_FAILED: "We couldn't save your changes. Please try again.",
  UPDATE_FAILED: "We couldn't update that. Please try again.",
  DELETE_FAILED: "We couldn't delete that. Please try again.",
  LOAD_FAILED: "We couldn't load this information. Please try again.",
  CREATE_FAILED: "We couldn't create that. Please try again.",
  SEND_FAILED: "We couldn't send that. Please try again.",
  UPLOAD_FAILED: "We couldn't upload that file. Please try again.",
  NETWORK: "You appear to be offline. Check your connection and try again.",
  TIMEOUT: "That took too long to respond. Please try again.",
  PERMISSION: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  SERVER: "The server ran into a problem. Please try again shortly.",
  VALIDATION: "Some details need fixing before you can continue.",
  COPY_FAILED: "We couldn't copy that to your clipboard.",
};

// Success tone — the user's action completed.
export const SUCCESS_MESSAGES = {
  SAVED: "Saved.",
  UPDATED: "Changes updated.",
  DELETED: "Deleted.",
  CREATED: "Created.",
  SENT: "Sent.",
  UPLOADED: "Uploaded.",
  COPIED: "Copied to your clipboard.",
};

// Info tone — neutral status the user should notice.
export const INFO_MESSAGES = {
  NO_CHANGES: "No changes to save.",
  WORKING: "Working on it…",
};

// Warning tone — completed, but with a caveat the user should act on.
export const WARNING_MESSAGES = {
  SAVED_LOCALLY: "Saved locally — the server was unavailable.",
  UNSAVED_CHANGES: "You have unsaved changes.",
};

// Tone → catalogue, so resolveMessage can prefer the caller's expected tone
// before falling back to a cross-catalogue lookup.
const CATALOGUES = {
  error: ERROR_MESSAGES,
  success: SUCCESS_MESSAGES,
  info: INFO_MESSAGES,
  warning: WARNING_MESSAGES,
};

/**
 * Resolve a catalogue key OR a literal message to a user-facing sentence.
 *
 * @param {string} keyOrText  A catalogue key (e.g. "SAVE_FAILED") or a ready
 *                            plain-English sentence.
 * @param {"error"|"success"|"info"|"warning"} [kind]  Preferred catalogue to
 *                            check first (matches the report* helper's tone).
 * @returns {string} The friendly sentence, or the input verbatim if it is not
 *                   a known key (so plain strings pass straight through).
 */
export function resolveMessage(keyOrText, kind = "error") {
  if (typeof keyOrText !== "string") {
    return keyOrText == null ? "" : String(keyOrText);
  }

  const preferred = CATALOGUES[kind];
  if (preferred && Object.prototype.hasOwnProperty.call(preferred, keyOrText)) {
    return preferred[keyOrText];
  }

  for (const catalogue of Object.values(CATALOGUES)) {
    if (Object.prototype.hasOwnProperty.call(catalogue, keyOrText)) {
      return catalogue[keyOrText];
    }
  }

  // Not a known key — treat it as a literal message the caller already wrote.
  return keyOrText;
}
