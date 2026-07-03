// file location: src/lib/validation/rules.js
// Configurable validation rules for the Frontend Feedback System (Phase 8).
//
// A rule is a factory that returns a validator: (value, allValues) => message | undefined.
// `undefined` (or empty string) means "valid"; a string is the plain-English
// error to show. A validator may return a Promise<string|undefined> for async
// checks (see `asyncRule`). Rules skip empty values so `required` owns emptiness
// — combine `required()` with a format rule to make a field mandatory.
//
// Usage (schema form):
//   const schema = {
//     email: [required("Email is required"), email()],
//     quantity: [required(), numeric(), min(1, "Order at least one")],
//   };
//
// Keep copy plain-English (rollout §1.1). Pass a custom message to override the
// default on any rule.

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

export const required = (message = "This field is required") => (value) =>
  isEmpty(value) ? message : undefined;

export const minLength = (length, message) => (value) =>
  !isEmpty(value) && String(value).trim().length < length
    ? message || `Must be at least ${length} characters`
    : undefined;

export const maxLength = (length, message) => (value) =>
  !isEmpty(value) && String(value).length > length
    ? message || `Must be ${length} characters or fewer`
    : undefined;

export const pattern = (regex, message = "Please check the format") => (value) =>
  !isEmpty(value) && !regex.test(String(value)) ? message : undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const email = (message = "Enter a valid email address") => (value) =>
  !isEmpty(value) && !EMAIL_RE.test(String(value).trim()) ? message : undefined;

// UK phone: digits, spaces, +, (), -, at least 7 digits. Lenient by design.
const PHONE_RE = /^[+()\d][\d\s()-]{6,}$/;
export const phone = (message = "Enter a valid phone number") => (value) =>
  !isEmpty(value) && !PHONE_RE.test(String(value).trim()) ? message : undefined;

export const numeric = (message = "Enter a number") => (value) =>
  !isEmpty(value) && Number.isNaN(Number(value)) ? message : undefined;

export const min = (limit, message) => (value) =>
  !isEmpty(value) && !Number.isNaN(Number(value)) && Number(value) < limit
    ? message || `Must be ${limit} or more`
    : undefined;

export const max = (limit, message) => (value) =>
  !isEmpty(value) && !Number.isNaN(Number(value)) && Number(value) > limit
    ? message || `Must be ${limit} or less`
    : undefined;

// Cross-field: value must equal another field's value (e.g. confirm password).
export const matches = (otherField, message = "Values do not match") => (value, values) =>
  value !== (values ? values[otherField] : undefined) ? message : undefined;

// Arbitrary predicate. `predicate(value, values)` truthy = valid.
export const custom = (predicate, message = "This value is not allowed") => (value, values) => {
  const result = predicate(value, values);
  if (result instanceof Promise) return result.then((ok) => (ok ? undefined : message));
  return result ? undefined : message;
};

// Async check — `check(value, values)` resolves truthy = valid. Skips empty
// values (so `required` fires first and you don't hit the network for blanks).
export const asyncRule = (check, message = "This value is not available") => (value, values) => {
  if (isEmpty(value)) return undefined;
  return Promise.resolve(check(value, values)).then((ok) => (ok ? undefined : message));
};
