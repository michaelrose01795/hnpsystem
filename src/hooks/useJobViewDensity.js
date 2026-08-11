import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { buildKey, readJSON, subscribe, writeJSON } from "@/lib/topbar/workspaceStorage";

const FEATURE = "jobs-view-density";
const DETAILED = "detailed";
const COMPACT = "compact";

const normaliseDensity = (value) => value === COMPACT ? COMPACT : DETAILED;

export default function useJobViewDensity() {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const storageKey = useMemo(() => buildKey(FEATURE, userId), [userId]);
  const [density, setDensityState] = useState(DETAILED);

  useEffect(() => {
    setDensityState(normaliseDensity(readJSON(storageKey, DETAILED)));
    return subscribe(storageKey, (value) => setDensityState(normaliseDensity(value)));
  }, [storageKey]);

  const setDensity = useCallback((nextDensity) => {
    const next = normaliseDensity(nextDensity);
    setDensityState(next);
    writeJSON(storageKey, next);
  }, [storageKey]);

  const toggleDensity = useCallback(() => {
    setDensity(density === COMPACT ? DETAILED : COMPACT);
  }, [density, setDensity]);

  return {
    density,
    isCompact: density === COMPACT,
    setDensity,
    toggleDensity,
  };
}
