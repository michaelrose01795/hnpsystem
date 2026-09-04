// file location: src/lib/customers/customerRecord.js
// Canonical shape of the Customer Details form, shared by the Create Job Card
// page and the Create Parts Order page. Extracted from /new-job so both pages
// render the same field set through <CustomerDetailsCard>.

export const CUSTOMER_FIELD_DEFINITIONS = [
  { label: "First Name", field: "firstName", type: "text", placeholder: "" },
  { label: "Last Name", field: "lastName", type: "text", placeholder: "" },
  { label: "Email", field: "email", type: "email", placeholder: "" },
  { label: "Mobile", field: "mobile", type: "tel", placeholder: "" },
  { label: "Telephone", field: "telephone", type: "tel", placeholder: "" },
  { label: "Address", field: "address", type: "textarea", placeholder: "" },
  { label: "Contact Preference", field: "contactPreference", type: "multi-select" },
];

export const initialCustomerFormState = {
  id: null,
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  telephone: "",
  address: "",
  postcode: "",
  contactPreference: ["email"],
};

// Map a Supabase customer row (snake_case, nullable) onto the form shape above.
export const normalizeCustomerRecord = (record = {}) => ({
  id: record?.id || record?.customer_id || null,
  firstName: record?.firstname || record?.firstName || initialCustomerFormState.firstName,
  lastName: record?.lastname || record?.lastName || initialCustomerFormState.lastName,
  email: record?.email || initialCustomerFormState.email,
  mobile: record?.mobile || initialCustomerFormState.mobile,
  telephone: record?.telephone || initialCustomerFormState.telephone,
  address: record?.address || initialCustomerFormState.address,
  postcode: record?.postcode || initialCustomerFormState.postcode,
  contactPreference: (() => {
    const raw =
      record?.contact_preference ??
      record?.contactPreference ??
      initialCustomerFormState.contactPreference;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLowerCase());
      if (cleaned.length) return cleaned;
      return [raw.toLowerCase()];
    }
    return initialCustomerFormState.contactPreference;
  })(),
});

// Trim a form value for persistence, collapsing empties to null so we never
// write "" into a nullable column.
export const toNullableCustomerValue = (value) => {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item).trim()).filter(Boolean).join(", ");
    return joined.length ? joined : null;
  }
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
};

// Build the Supabase update payload from the editable form state.
export const buildCustomerUpdatePayload = (customerForm = {}) => ({
  firstname: (customerForm.firstName || "").trim(),
  lastname: (customerForm.lastName || "").trim(),
  email: toNullableCustomerValue(customerForm.email),
  mobile: toNullableCustomerValue(customerForm.mobile),
  telephone: toNullableCustomerValue(customerForm.telephone),
  address: toNullableCustomerValue(customerForm.address),
  postcode: toNullableCustomerValue(customerForm.postcode),
  contact_preference: toNullableCustomerValue(customerForm.contactPreference) || "email",
});
