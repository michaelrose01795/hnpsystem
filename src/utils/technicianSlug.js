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

export const generateTechnicianSlug = (firstName, lastName, userId) => {
  const first = formatSegment(firstName);
  const last = formatSegment(lastName);
  const namePart = `${first}${last}`.trim();
  const idSuffix = userId !== undefined && userId !== null ? `-${sanitize(userId)}` : "";
  if (namePart) {
    return `${namePart}${idSuffix}`;
  }
  if (idSuffix) {
    return `Tech${idSuffix}`;
  }
  return "Technician";
};

export default generateTechnicianSlug;
