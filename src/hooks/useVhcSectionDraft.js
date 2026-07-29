// file location: src/hooks/useVhcSectionDraft.js
import { useCallback, useEffect, useMemo, useRef } from "react";

const STORAGE_PREFIX = "hnp:vhc-section-draft:v1";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normaliseKeyPart = (value, fallback) => {
  const text = String(value ?? "").trim();
  return encodeURIComponent(text || fallback);
};

export const buildVhcSectionDraftKey = ({
  sectionKey,
  jobId,
  jobNumber,
  userId,
}) => {
  if (!sectionKey || (!jobId && !jobNumber)) return "";
  const jobKey = jobId ? `id-${jobId}` : `number-${jobNumber}`;
  return [
    STORAGE_PREFIX,
    normaliseKeyPart(userId, "shared"),
    normaliseKeyPart(jobKey, "unknown-job"),
    normaliseKeyPart(sectionKey, "unknown-section"),
  ].join(":");
};

export const readVhcSectionDraft = (storageKey, fallback = null) => {
  if (!storageKey) return fallback;
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.value ?? fallback;
  } catch {
    return fallback;
  }
};

export const persistVhcSectionDraft = (storageKey, value) => {
  if (!storageKey || value === undefined) return false;
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({
        updatedAt: Date.now(),
        value,
      })
    );
    return true;
  } catch {
    return false;
  }
};

export const clearVhcSectionDraft = (storageKey) => {
  if (!storageKey) return false;
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
};

export default function useVhcSectionDraft({
  sectionKey,
  jobId,
  jobNumber,
  userId,
  isOpen,
  onComplete,
}) {
  const onCompleteRef = useRef(onComplete);
  const pendingValueRef = useRef(undefined);
  const persistTimeoutRef = useRef(null);
  const storageKey = useMemo(
    () => buildVhcSectionDraftKey({ sectionKey, jobId, jobNumber, userId }),
    [jobId, jobNumber, sectionKey, userId]
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const readDraft = useCallback(
    (fallback = null) => readVhcSectionDraft(storageKey, fallback),
    [storageKey]
  );

  const flushDraft = useCallback(() => {
    if (pendingValueRef.current === undefined) return false;
    const pendingValue = pendingValueRef.current;
    pendingValueRef.current = undefined;
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
    return persistVhcSectionDraft(storageKey, pendingValue);
  }, [storageKey]);

  const persistDraft = useCallback(
    (value) => {
      if (!isOpen || !storageKey || typeof window === "undefined") return false;
      pendingValueRef.current = value;
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
      }
      persistTimeoutRef.current = window.setTimeout(flushDraft, 100);
      return true;
    },
    [flushDraft, isOpen, storageKey]
  );

  const clearDraft = useCallback(
    () => {
      if (persistTimeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      pendingValueRef.current = undefined;
      return clearVhcSectionDraft(storageKey);
    },
    [storageKey]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("beforeunload", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushDraft();
    };
  }, [flushDraft]);

  const completeDraft = useCallback(
    async (payload) => {
      if (typeof onCompleteRef.current !== "function") return false;
      const result = await onCompleteRef.current(payload);
      if (result === false) return false;
      clearDraft();
      return result;
    },
    [clearDraft]
  );

  return {
    storageKey,
    readDraft,
    persistDraft,
    clearDraft,
    completeDraft,
  };
}
