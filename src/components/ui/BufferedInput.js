// file location: src/components/ui/BufferedInput.js
//
// A text/number input (or textarea) that stays responsive on large forms.
//
// THE PROBLEM IT SOLVES
// On a page like /new-job, a plain controlled input calls setState on the page
// root for every keystroke. The root then re-renders a very large tree, so the
// browser cannot paint the character until that render completes — which is
// exactly what INP measures. The typing feels heavy even though nothing
// expensive is happening per character.
//
// HOW IT BEHAVES
// The value the user sees comes from local state, so every keystroke paints
// immediately. The parent is notified on a short debounce, i.e. roughly once per
// pause rather than once per character.
//
// CORRECTNESS
// A debounce that only fires on a timer can lose the last keystrokes if the user
// types and immediately clicks Save. This component flushes the pending value:
//   * on blur (which fires before the click handler of a Save button),
//   * on Enter,
//   * on unmount,
//   * and when the form is submitted (blur covers this).
// So the parent always ends up with what the user typed.
//
// It also accepts an external value change (a preset being applied, a form
// reset) and re-syncs, without echoing that back to the parent.

import React, { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 200;

export default function BufferedInput({
  value,
  onChange,
  as = "input",
  delayMs = DEFAULT_DELAY_MS,
  onBlur,
  onKeyDown,
  ...rest
}) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const externalRef = useRef(value);
  // Keep the latest onChange without making it a dependency, so a parent that
  // recreates its handler every render does not restart the debounce.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Re-sync when the value changes from outside (preset applied, form cleared).
  useEffect(() => {
    if (value !== externalRef.current) {
      externalRef.current = value;
      setLocalValue(value ?? "");
      pendingRef.current = null;
      clearTimeout(timerRef.current);
    }
  }, [value]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    if (pendingRef.current === null) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    externalRef.current = next;
    onChangeRef.current?.(next);
  }, []);

  // Flush anything still pending when this field goes away.
  useEffect(() => () => flush(), [flush]);

  const handleChange = (event) => {
    const next = event.target.value;
    setLocalValue(next);
    pendingRef.current = next;
    externalRef.current = next; // prevents the sync effect above from fighting us
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  };

  const handleBlur = (event) => {
    flush();
    onBlur?.(event);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && as !== "textarea") flush();
    onKeyDown?.(event);
  };

  const Tag = as === "textarea" ? "textarea" : "input";
  return (
    <Tag
      {...rest}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
