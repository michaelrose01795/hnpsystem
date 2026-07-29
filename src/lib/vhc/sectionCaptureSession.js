// Business logic for the per-section VHC camera's deferred upload queue.
// Keeping the batch operation outside the React component makes partial
// failures deterministic: successful files remain saved while failed items
// stay in the review queue for a retry.

export function buildCaptureConcernLink(concern = {}) {
  return {
    section: concern.section || "",
    category: concern.category || null,
    categoryLabel: concern.categoryLabel || null,
    concernId: concern.concernId,
    index: concern.index ?? null,
    label: concern.label || "",
    status: concern.status || "",
  };
}

export async function uploadSectionCaptureQueue({
  items = [],
  uploadFile,
  uploadContext = {},
  concern,
}) {
  const saved = [];
  const failed = [];
  const concernLink = buildCaptureConcernLink(concern);

  for (const item of items) {
    try {
      const file = await uploadFile({
        ...uploadContext,
        file: item.file,
        visibleToCustomer: true,
        concernLink,
      });
      saved.push({ itemId: item.id, file });
    } catch (error) {
      failed.push({ itemId: item.id, item, error });
    }
  }

  return { saved, failed };
}
