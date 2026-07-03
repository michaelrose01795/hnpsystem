// file location: src/lib/validation/validate.js
// Pure validation runner for the Frontend Feedback System (Phase 8).
//
// Runs a schema against a values object and returns an { field: message } map of
// ONLY the fields that failed. Supports:
//   • per-field rule arrays        schema = { email: [required(), email()] }
//   • a single rule per field      schema = { email: required() }
//   • a whole-form function        schema = (values) => ({ email: "..." })
//   • async rules (Promises)       — awaited; the first failing rule per field wins.
//
// Kept side-effect free so it can back the hook, a server handler, or a test.

/**
 * @param {object} values  Current form values.
 * @param {object|Function} schema  Field→rule(s) map, or a (values)=>errors fn.
 * @returns {Promise<Record<string,string>>}  Map of failing field → message.
 */
export async function runValidation(values, schema) {
  if (!schema) return {};

  if (typeof schema === "function") {
    const result = await schema(values || {});
    return pruneEmpty(result || {});
  }

  const errors = {};
  await Promise.all(
    Object.entries(schema).map(async ([field, ruleOrRules]) => {
      const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
      for (const rule of rules) {
        if (typeof rule !== "function") continue;
        let message = rule(values ? values[field] : undefined, values || {});
        if (message instanceof Promise) message = await message;
        if (message) {
          errors[field] = message; // first failing rule wins
          break;
        }
      }
    })
  );
  return errors;
}

/**
 * The field that should receive focus after a failed submit. Honours an explicit
 * `order` (usually the visual/tab order) so focus lands on the first invalid
 * field the user can see, not an arbitrary object-key order.
 */
export function firstInvalidField(errors, order) {
  if (!errors) return null;
  if (Array.isArray(order) && order.length) {
    for (const name of order) {
      if (errors[name]) return name;
    }
  }
  const keys = Object.keys(errors);
  return keys.length ? keys[0] : null;
}

function pruneEmpty(map) {
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (value) out[key] = value;
  }
  return out;
}
