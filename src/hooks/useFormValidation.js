// file location: src/hooks/useFormValidation.js
// The single reusable form-validation hook for the Frontend Feedback System
// (Phase 8). One consistent behaviour everywhere:
//
//   • inline field errors (never an alert() popup),
//   • accessible wiring — aria-invalid + aria-describedby via getFieldProps,
//   • focus (and scroll) the FIRST invalid field on a failed submit,
//   • live re-validation AFTER the first submit attempt (so fixes clear as typed),
//   • optional real-time validation while editing (validateOnChange),
//   • a grouped error summary for large forms (summaryErrors),
//   • async validation (rules may return Promises),
//   • server-side field errors via setFieldError (e.g. "email already exists"),
//   • integration with the Phase 3/5 reporting helpers — throw inside onSubmit
//     and catch with reportApiError, or return field errors for inline display.
//
// Usage:
//   const form = useFormValidation({
//     initialValues: { email: "", role: "" },
//     schema: { email: [required(), email()], role: required("Pick a role") },
//     fieldOrder: ["email", "role"],
//     onSubmit: async (values) => { await createUser(values); },
//   });
//   <form onSubmit={form.handleSubmit} noValidate>
//     <InputField label="Email" error={form.errors.email} {...form.getFieldProps("email")} />
//     <Button type="submit" busy={form.submitting}>Create</Button>
//   </form>
//
// `errors` is only populated once validation has run (first submit, or on change
// when live), so fields stay pristine until the user has actually tried — no
// red-on-load. Pass a STABLE schema/onSubmit (module scope or useMemo/useCallback)
// or rely on the internal refs below, which always read the latest closure.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runValidation, firstInvalidField } from "@/lib/validation/validate";

export default function useFormValidation(config = {}) {
  const {
    initialValues = {},
    schema = {},
    validateOnChange = false,
    fieldOrder,
    onSubmit,
  } = config;

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Latest-closure refs so handler identities stay stable even when callers pass
  // inline schema/onSubmit objects that change every render.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const orderRef = useRef(fieldOrder);
  orderRef.current = fieldOrder;
  const initialRef = useRef(initialValues);

  // Stable per-field ref callbacks (for focus) — created once per field name so
  // React doesn't detach/reattach on every render.
  const fieldEls = useRef({});
  const refCallbacks = useRef({});
  const getRef = useCallback((name) => {
    if (!refCallbacks.current[name]) {
      refCallbacks.current[name] = (el) => {
        if (el) fieldEls.current[name] = el;
        else delete fieldEls.current[name];
      };
    }
    return refCallbacks.current[name];
  }, []);

  const focusField = useCallback((name) => {
    const el = fieldEls.current[name];
    if (el && typeof el.focus === "function") {
      el.focus();
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, []);

  const live = submitted || validateOnChange;

  // Live re-validation: once the user has submitted (or when real-time is on),
  // recompute errors whenever the values change so fixes clear immediately.
  useEffect(() => {
    if (!live) return undefined;
    let active = true;
    runValidation(values, schemaRef.current).then((errs) => {
      if (active) setErrors(errs);
    });
    return () => {
      active = false;
    };
  }, [values, live]);

  const handleChange = useCallback((event) => {
    const target = event && event.target;
    if (!target || !target.name) return;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setValues((prev) => ({ ...prev, [target.name]: value }));
  }, []);

  const handleBlur = useCallback((event) => {
    const name = event && event.target && event.target.name;
    if (name) setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Manually mark a field invalid — for server-side errors surfaced after submit
  // (e.g. a 409 "email already exists"). Focuses the field so the fix is obvious.
  const setFieldError = useCallback(
    (name, message) => {
      setSubmitted(true);
      setErrors((prev) => ({ ...prev, [name]: message }));
      focusField(name);
    },
    [focusField]
  );

  const handleSubmit = useCallback(
    async (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      setSubmitted(true);

      const errs = await runValidation(values, schemaRef.current);
      setErrors(errs);
      setTouched((prev) => {
        const all = { ...prev };
        for (const key of Object.keys(schemaRef.current || {})) all[key] = true;
        return all;
      });

      const firstBad = firstInvalidField(errs, orderRef.current);
      if (firstBad) {
        focusField(firstBad);
        return { ok: false, errors: errs };
      }

      if (typeof onSubmitRef.current === "function") {
        setSubmitting(true);
        try {
          await onSubmitRef.current(values, { setFieldError, setErrors, reset });
        } finally {
          setSubmitting(false);
        }
      }
      return { ok: true, errors: {} };
    },
    // reset is defined below; it is stable (useCallback), safe to omit here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, focusField, setFieldError]
  );

  const reset = useCallback((next) => {
    setValues(next || initialRef.current);
    setErrors({});
    setTouched({});
    setSubmitted(false);
    setSubmitting(false);
  }, []);

  // Props to spread onto a field (native control OR <InputField>). Supplies the
  // controlled value, change/blur handlers, focus ref, id, and the a11y wiring.
  const getFieldProps = useCallback(
    (name, options = {}) => {
      const id = options.id || `field-${name}`;
      const hasError = Boolean(errors[name]);
      const props = {
        id,
        name,
        value: values[name] == null ? "" : values[name],
        onChange: handleChange,
        onBlur: handleBlur,
        ref: getRef(name),
        "aria-invalid": hasError ? "true" : undefined,
        "aria-describedby": hasError ? `${id}-error` : undefined,
      };
      // Success state: touched + validated + non-empty + no error.
      if (live && touched[name] && !hasError && props.value !== "") {
        props["data-valid"] = "true";
      }
      return props;
    },
    [values, errors, touched, live, handleChange, handleBlur, getRef]
  );

  const summaryErrors = useMemo(
    () =>
      Object.entries(errors)
        .filter(([, message]) => message)
        .map(([name, message]) => ({ name, message, id: `field-${name}` })),
    [errors]
  );

  const isValid = summaryErrors.length === 0;

  return {
    values,
    errors,
    touched,
    submitted,
    submitting,
    isValid,
    setValues,
    setFieldValue,
    setFieldError,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldProps,
    focusField,
    reset,
    summaryErrors,
  };
}
