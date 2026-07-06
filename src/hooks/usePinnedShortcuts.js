// file location: src/hooks/usePinnedShortcuts.js
//
// Pinned shortcuts (Phase 2.5). Lets a user pin favourite pages so they appear
// as quick chips in the top bar. Per-user, on-device, reactive across tabs.
// Disabled in the presentation shell.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import {
  buildKey,
  readJSON,
  writeJSON,
  subscribe,
} from "@/lib/topbar/workspaceStorage";

const FEATURE = "pins";
const MAX_PINS = 8;

function normalisePins(value) {
  return Array.isArray(value) ? value.filter((p) => p && p.href) : [];
}

export function usePinnedShortcuts({ enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [pins, setPins] = useState(() => (enabled ? normalisePins(readJSON(key, [])) : []));

  useEffect(() => {
    setPins(enabled ? normalisePins(readJSON(key, [])) : []);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setPins(normalisePins(value)));
  }, [key, enabled]);

  const isPinned = useCallback(
    (href) => pins.some((p) => p.href === href),
    [pins]
  );

  const togglePin = useCallback(
    (item) => {
      if (!enabled || !item?.href) return;
      const exists = pins.some((p) => p.href === item.href);
      const next = exists
        ? pins.filter((p) => p.href !== item.href)
        : [{ href: item.href, label: item.label || item.href, ts: Date.now() }, ...pins].slice(
            0,
            MAX_PINS
          );
      setPins(next);
      writeJSON(key, next);
    },
    [pins, key, enabled]
  );

  const removePin = useCallback(
    (href) => {
      if (!enabled) return;
      const next = pins.filter((p) => p.href !== href);
      setPins(next);
      writeJSON(key, next);
    },
    [pins, key, enabled]
  );

  // Chips are capped for the bar; the full list stays available for menus.
  const visiblePins = useMemo(() => pins.slice(0, MAX_PINS), [pins]);

  return { pins: visiblePins, allPins: pins, isPinned, togglePin, removePin, canPin: enabled };
}

export default usePinnedShortcuts;
