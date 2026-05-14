import { useEffect } from "react";

const MODAL_LOCK_CLASS = "modal-open";
const MODAL_LOCK_KEY = "__hnpModalLockCount";
const MODAL_SCROLL_Y_KEY = "__hnpModalScrollY";
const MODAL_SCROLL_X_KEY = "__hnpModalScrollX";
const MODAL_BODY_STYLE_KEY = "__hnpModalBodyStyle";

function getLockCount() {
  if (typeof window === "undefined") return 0;
  const value = Number(window[MODAL_LOCK_KEY] || 0);
  return Number.isFinite(value) ? value : 0;
}

function setLockCount(nextCount) {
  if (typeof window === "undefined") return;
  window[MODAL_LOCK_KEY] = nextCount;
}

function captureBodyState() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  window[MODAL_SCROLL_X_KEY] = scrollX;
  window[MODAL_SCROLL_Y_KEY] = scrollY;
  window[MODAL_BODY_STYLE_KEY] = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    maxWidth: document.body.style.maxWidth,
    overflow: document.body.style.overflow,
  };
}

function applyBodyScrollLock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const scrollX = Number(window[MODAL_SCROLL_X_KEY] || 0);
  const scrollY = Number(window[MODAL_SCROLL_Y_KEY] || 0);
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = `-${scrollX}px`;
  document.body.style.right = "0";
  document.body.style.width = "100vw";
  document.body.style.maxWidth = "100vw";
  document.body.style.overflow = "hidden";
}

function restoreBodyState() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const previous = window[MODAL_BODY_STYLE_KEY] || {};
  const scrollX = Number(window[MODAL_SCROLL_X_KEY] || 0);
  const scrollY = Number(window[MODAL_SCROLL_Y_KEY] || 0);
  document.body.style.position = previous.position || "";
  document.body.style.top = previous.top || "";
  document.body.style.left = previous.left || "";
  document.body.style.right = previous.right || "";
  document.body.style.width = previous.width || "";
  document.body.style.maxWidth = previous.maxWidth || "";
  document.body.style.overflow = previous.overflow || "";
  window.scrollTo(scrollX, scrollY);
  delete window[MODAL_BODY_STYLE_KEY];
  delete window[MODAL_SCROLL_X_KEY];
  delete window[MODAL_SCROLL_Y_KEY];
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
    if (currentCount === 0) {
      captureBodyState();
      applyBodyScrollLock();
    }
    setLockCount(nextCount);
    applyLockClass();

    return () => {
      const decremented = Math.max(0, getLockCount() - 1);
      setLockCount(decremented);
      if (decremented === 0) {
        removeLockClass();
        restoreBodyState();
      }
    };
  }, [isLocked]);
}
