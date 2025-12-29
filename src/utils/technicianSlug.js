const sanitize = (value) => {
  if (!value) return "";
  return value.toString().replace(/[^a-zA-Z0-9]/g, "");
};

const formatSegment = (value) => {
  const sanitized = sanitize(value).trim();
  if (!sanitized) {
    return "";
  }
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
};

export const generateTechnicianSlug = (firstName, lastName, fallbackId) => {
  const first = formatSegment(firstName);
  const last = formatSegment(lastName);
  const combinedName = `${first}${last}`.trim();
  if (combinedName) {
    return combinedName;
  }
  if (fallbackId !== undefined && fallbackId !== null) {
    return `Tech${sanitize(fallbackId)}`;
  }
  return "Technician";
};

export default generateTechnicianSlug;
