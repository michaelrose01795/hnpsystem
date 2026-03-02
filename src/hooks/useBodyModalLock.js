import { useEffect } from "react";

const MODAL_LOCK_CLASS = "modal-open";
const MODAL_LOCK_KEY = "__hnpModalLockCount";

function getLockCount() {
  if (typeof window === "undefined") return 0;
  const value = Number(window[MODAL_LOCK_KEY] || 0);
  return Number.isFinite(value) ? value : 0;
}

function setLockCount(nextCount) {
  if (typeof window === "undefined") return;
  window[MODAL_LOCK_KEY] = nextCount;
}

function applyLockClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(MODAL_LOCK_CLASS);
  document.body.classList.add(MODAL_LOCK_CLASS);
}

function removeLockClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(MODAL_LOCK_CLASS);
  document.body.classList.remove(MODAL_LOCK_CLASS);
}

export default function useBodyModalLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return undefined;

    const currentCount = getLockCount();
    const nextCount = currentCount + 1;
    setLockCount(nextCount);
    applyLockClass();

    return () => {
      const decremented = Math.max(0, getLockCount() - 1);
      setLockCount(decremented);
      if (decremented === 0) {
        removeLockClass();
      }
    };
  }, [isLocked]);
}
