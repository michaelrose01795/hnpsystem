// file location: src/hooks/useCaptureLayoutFingerprint.js
// Shared hook used by Layout.js and CustomerLayout.js to capture a route-keyed
// layout fingerprint after a page finishes loading. The fingerprint snapshot is
// what <PageContentSkeleton> uses on subsequent visits to render shimmer blocks
// at the *exact* rectangles of the real page — so the first visible loading
// frame mirrors the real layout rather than a generic template.
//
// Lifts the effect out of the two layouts so they share a single implementation
// and so we can add cross-cutting concerns (viewport-bucket invalidation) in one
// place instead of two.
import { useEffect } from "react";
import {
  captureLayoutFingerprint,
  setLayoutFingerprint,
} from "@/lib/loading/layoutFingerprint";

/**
 * @param {React.RefObject<HTMLElement>} ref   — element whose rect bounds define
 *                                               the fingerprint container.
 * @param {string} route                       — cache key; pass `router.asPath || router.pathname`.
 * @param {boolean} paused                     — truthy while the skeleton overlay
 *                                               is still on screen. Capture only
 *                                               runs when this is false.
 * @param {unknown} [trigger]                  — additional dependency that should
 *                                               cause a recapture when it changes
 *                                               (e.g. the content key / viewport bucket).
 */
export default function useCaptureLayoutFingerprint(ref, route, paused, trigger) {
  useEffect(() => {
    if (paused) return undefined;
    if (typeof window === "undefined") return undefined;
    const el = ref?.current;
    if (!el) return undefined;

    let timeoutId = null;
    const rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        const fingerprint = captureLayoutFingerprint(el);
        if (fingerprint) setLayoutFingerprint(route, fingerprint);
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    // ref is stable (refs don't need to be in deps). We recapture whenever the
    // route changes, when the overlay lifts, or when the caller-provided trigger
    // changes (e.g. viewport bucket flips and we want a fresh fingerprint).
  }, [ref, route, paused, trigger]);
}
