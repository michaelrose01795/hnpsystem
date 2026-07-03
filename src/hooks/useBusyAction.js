// file location: src/hooks/useBusyAction.js
// Reusable "button-busy" guard for async actions (Frontend Feedback System, Phase 6).
//
// Wraps an async handler so it:
//   1. cannot double-fire — a second call while the first is still in flight is
//      ignored, guarding against double-submits even if the button hasn't been
//      disabled in time (fast double-click, Enter-key repeat), and
//   2. exposes a `busy` flag to drive <Button busy> (disable + inline spinner).
//
// Usage:
//   const [saveNote, savingNote] = useBusyAction(async () => { await createNote(...); });
//   <Button busy={savingNote} onClick={saveNote}>Save note</Button>
//
// The returned runner resolves to the action's value (or `undefined` when a call
// is ignored as an in-flight duplicate). Errors propagate to the caller unchanged
// unless an `onError` handler is supplied — so existing try/catch + reportError
// flows keep working without modification.

import { useCallback, useEffect, useRef, useState } from "react";

export default function useBusyAction(action, options = {}) {
  const { onError } = options;
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // Keep the latest action/onError without re-creating `run`, so the runner
  // identity stays stable (safe to pass straight to onClick / deps arrays).
  const actionRef = useRef(action);
  actionRef.current = action;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    if (inFlightRef.current) return undefined; // ignore re-entrant double-fire
    inFlightRef.current = true;
    setBusy(true);
    try {
      return await actionRef.current(...args);
    } catch (err) {
      if (onErrorRef.current) {
        onErrorRef.current(err);
        return undefined;
      }
      throw err;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, []);

  return [run, busy];
}
