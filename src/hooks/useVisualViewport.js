// file location: src/hooks/useVisualViewport.js
//
// Tracks the part of the screen the user can actually see.
//
// On a phone the layout viewport (what `100vh` / `position: fixed` measure
// against) is NOT what is on screen. iOS Safari keeps the layout viewport at
// full height when the on-screen keyboard opens and instead shrinks and pans
// the *visual* viewport, so a bar pinned to the bottom of `100vh` ends up under
// the keyboard. `dvh` does not help either: it tracks the browser toolbars, not
// the keyboard. window.visualViewport is the only reliable source, so a layout
// that must keep something (a message composer) above the keyboard pins itself
// to these numbers.
//
// Returns null while disabled or before the first client measurement, so the
// caller can fall back to its CSS sizing on the server and first paint.
//
// `focusScope` (optional CSS selector) narrows `keyboardOpen` to "the keyboard
// is open for a field inside this area". A layout that reacts to the keyboard
// by hiding its own chrome must not hide the very field the user is typing in.

import { useEffect, useState } from "react";

// A keyboard takes at least ~40% of a portrait phone. Browser toolbar
// collapse/expand only moves the visual viewport by ~50-120px, so anything
// past this is the keyboard, not the toolbars.
const KEYBOARD_THRESHOLD_PX = 150;

export default function useVisualViewport(enabled = true, { focusScope = null } = {}) {
  const [viewport, setViewport] = useState(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setViewport(null);
      return undefined;
    }

    const vv = window.visualViewport || null;
    let frame = 0;
    // Keyboard detection compares against the tallest height seen at the
    // current width, not window.innerHeight: iOS and default Android keep
    // innerHeight fixed under the keyboard, but Android's resizes-content mode
    // (and a desktop emulator) shrink it together with the visual viewport.
    // A width change is a rotation or resize, so the reference resets.
    let referenceWidth = 0;
    let referenceHeight = 0;

    const measure = () => {
      frame = 0;
      const height = Math.round(vv ? vv.height : window.innerHeight);
      const offsetTop = Math.round(vv ? vv.offsetTop : 0);
      const focused = document.activeElement;
      const inScope = !focusScope || Boolean(focused && focused.closest && focused.closest(focusScope));
      const width = Math.round(vv ? vv.width : window.innerWidth);
      if (width !== referenceWidth) {
        referenceWidth = width;
        referenceHeight = 0;
      }
      referenceHeight = Math.max(referenceHeight, height, window.innerHeight);
      const keyboardOpen = inScope && referenceHeight - height > KEYBOARD_THRESHOLD_PX;
      setViewport((prev) =>
        prev &&
        prev.height === height &&
        prev.offsetTop === offsetTop &&
        prev.keyboardOpen === keyboardOpen
          ? prev
          : { height, offsetTop, keyboardOpen }
      );
    };

    // Coalesce to one update per frame: visualViewport fires scroll events
    // continuously while iOS pans the page under the keyboard.
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    const target = vv || window;
    target.addEventListener("resize", schedule);
    if (vv) vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);
    // Focus moving between fields changes `keyboardOpen` under a focusScope
    // without any viewport event.
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      target.removeEventListener("resize", schedule);
      if (vv) vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [enabled, focusScope]);

  return enabled ? viewport : null;
}
