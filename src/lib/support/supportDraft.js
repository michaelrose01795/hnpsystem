// file location: src/lib/support/supportDraft.js
//
// Pre-Phase-5 enhancement — local draft persistence for the Help & Diagnostics
// ("support") report popup. The draft (category, description, captured
// screenshots) is auto-saved as the user types/captures and survives closing the
// popup or reloading the page; it is cleared only when the report is sent or the
// user presses "Clear".
//
// PURE + storage-injected so it is unit-testable in node (no window). The browser
// passes window.localStorage; tests pass an in-memory stub. Nothing here ever
// leaves the device — the draft lives only in the user's own storage, and the
// privacy guarantees (record-time + capture-time + server-side sanitisation)
// continue to apply to anything that is eventually submitted.

export const SUPPORT_DRAFT_STORAGE_KEY = "hnp-support-report-draft-v1";

const MAX_DESCRIPTION = 5000; // mirrors the server description cap
export const MAX_DRAFT_SCREENSHOTS = 6; // sane upper bound on captures per report
// localStorage budget guard — screenshots are base64 PNGs and can be large. If a
// draft exceeds this, we persist it WITHOUT screenshots rather than throw/QuotaExceeded.
const MAX_DRAFT_BYTES = 3 * 1024 * 1024;

const MAX_ANNOTATION = 500;
const isImageDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/");

// A screenshot is stored as { src, annotation }. Legacy drafts stored bare data
// URLs; coerce those into the object shape. Drops anything without a valid image.
function normaliseScreenshot(shot) {
  if (isImageDataUrl(shot)) return { src: shot, annotation: "" };
  if (shot && typeof shot === "object" && isImageDataUrl(shot.src)) {
    return {
      src: shot.src,
      annotation: typeof shot.annotation === "string" ? shot.annotation.slice(0, MAX_ANNOTATION) : "",
    };
  }
  return null;
}

/**
 * Coerce an arbitrary parsed object into the canonical draft shape, applying all
 * caps. Unknown / malformed fields are dropped.
 * @param {object} [draft]
 * @returns {{ category: string|null, description: string, descriptionEdited: boolean, screenshots: {src:string, annotation:string}[] }}
 */
export function normaliseDraft(draft = {}) {
  return {
    category: typeof draft?.category === "string" && draft.category ? draft.category : null,
    description:
      typeof draft?.description === "string" ? draft.description.slice(0, MAX_DESCRIPTION) : "",
    descriptionEdited: Boolean(draft?.descriptionEdited),
    screenshots: Array.isArray(draft?.screenshots)
      ? draft.screenshots.map(normaliseScreenshot).filter(Boolean).slice(0, MAX_DRAFT_SCREENSHOTS)
      : [],
  };
}

/**
 * True when the draft carries nothing worth restoring.
 * @param {object} [draft]
 */
export function isDraftEmpty(draft) {
  const d = normaliseDraft(draft);
  return !d.description.trim() && d.screenshots.length === 0 && !d.category;
}

/** Serialise a draft to a JSON string (after normalisation). */
export function serialiseDraft(draft) {
  return JSON.stringify(normaliseDraft(draft));
}

/**
 * Load + normalise the saved draft. Returns null when absent or unreadable.
 * @param {Storage} storage
 */
export function loadDraft(storage) {
  try {
    const raw = storage?.getItem?.(SUPPORT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return normaliseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Persist the draft. If the payload is too large for storage, it is re-saved
 * without screenshots so the text draft is never lost.
 * @param {Storage} storage
 * @param {object} draft
 * @returns {{ ok: boolean, trimmed?: boolean }}
 */
export function saveDraft(storage, draft) {
  const normalised = normaliseDraft(draft);
  try {
    let payload = JSON.stringify(normalised);
    let trimmed = false;
    if (payload.length > MAX_DRAFT_BYTES) {
      payload = JSON.stringify({ ...normalised, screenshots: [] });
      trimmed = true;
    }
    storage?.setItem?.(SUPPORT_DRAFT_STORAGE_KEY, payload);
    return { ok: true, trimmed };
  } catch {
    // A late QuotaExceededError (e.g. when even the slim payload is rejected) —
    // try one more time without screenshots, then give up silently.
    try {
      storage?.setItem?.(SUPPORT_DRAFT_STORAGE_KEY, JSON.stringify({ ...normalised, screenshots: [] }));
      return { ok: true, trimmed: true };
    } catch {
      return { ok: false };
    }
  }
}

/** Remove the saved draft entirely. */
export function clearDraft(storage) {
  try {
    storage?.removeItem?.(SUPPORT_DRAFT_STORAGE_KEY);
  } catch {
    // ignore — nothing else we can do
  }
}
