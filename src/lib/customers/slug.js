// file location: src/lib/customers/slug.js

const stripDiacritics = (value = "") =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const toPascalCase = (value = "") =>
  stripDiacritics(value)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join("");

export const normalizeCustomerSlug = (value = "") => {
  const safe = stripDiacritics(String(value || ""));
  return safe.toLowerCase().replace(/[^a-z0-9]/g, "");
};

export const createCustomerDisplaySlug = (firstname = "", lastname = "") => {
  const safeFirst = toPascalCase(firstname);
  const safeLast = toPascalCase(lastname);
  return `${safeFirst}${safeLast}`.trim();
};

export const buildSlugKeyFromNames = (firstname = "", lastname = "") =>
  normalizeCustomerSlug(`${firstname || ""}${lastname || ""}`);

export const splitCustomerSlugParts = (value = "") => {
  if (!value || typeof value !== "string") {
    return { firstName: "", lastName: "" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const spaced = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
  const cleaned = spaced.replace(/[^a-zA-Z ]+/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  const parts = cleaned.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
};

export default {
  normalizeCustomerSlug,
  createCustomerDisplaySlug,
  buildSlugKeyFromNames,
  splitCustomerSlugParts,
};
