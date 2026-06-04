// file location: src/lib/customers/contactPreference.js
// Single source of truth for customer contact-preference values, shared by the
// staff customer profile page (src/pages/customers/[customerSlug].js) and the
// /website customer portal (src/pages/website/profile.js + its auth APIs) so a
// choice made on either side always reads back correctly on the other.
//
// The `customers.contact_preference` column is a free-text field, so before this
// existed the two surfaces drifted: the portal wrote email/phone/sms/post while
// the staff page only understood email/mobile/telephone. normalizeContactPreference
// folds every legacy/alternate spelling onto the canonical set below.

export const CONTACT_PREFERENCE_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "mobile", label: "Mobile" },
  { value: "telephone", label: "Telephone" },
  { value: "sms", label: "SMS" },
  { value: "post", label: "Post" },
];

export const CONTACT_PREFERENCE_VALUES = CONTACT_PREFERENCE_OPTIONS.map(
  (option) => option.value
);

// Legacy / alternate spellings mapped onto the canonical set. "phone" was the
// portal's old value for a mobile number before this vocabulary was unified.
const CONTACT_PREFERENCE_ALIASES = {
  phone: "mobile",
  mobile_phone: "mobile",
  cell: "mobile",
  landline: "telephone",
  tel: "telephone",
  text: "sms",
  mail: "post",
  letter: "post",
};

export const normalizeContactPreference = (value) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "";
  if (CONTACT_PREFERENCE_VALUES.includes(raw)) return raw;
  return CONTACT_PREFERENCE_ALIASES[raw] || "";
};

export const contactPreferenceLabel = (value) => {
  const normalized = normalizeContactPreference(value);
  return (
    CONTACT_PREFERENCE_OPTIONS.find((option) => option.value === normalized)
      ?.label || ""
  );
};

export default {
  CONTACT_PREFERENCE_OPTIONS,
  CONTACT_PREFERENCE_VALUES,
  normalizeContactPreference,
  contactPreferenceLabel,
};
