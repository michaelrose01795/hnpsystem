export const normalizeStatusId = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return normalized.replace(/[^a-z0-9]+/g, "_");
};
