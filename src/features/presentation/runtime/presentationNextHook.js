// Cross-component hook for the presentation deck's "Next" action.
//
// Some real pages render a blocking step that the presenter must clear before
// the deck should advance (e.g. the /profile personal tab shows an "Unlock
// personal dashboard" passcode popup). Rather than make the presenter click a
// button inside the page, that page registers an interceptor here. When the
// deck's Next is pressed, PresentationProvider gives the interceptor first
// refusal: if it handles the press (returns true) the deck stays put for that
// click; otherwise the deck advances as normal.
//
// The interceptor is a single module-scope slot — only one blocking step can
// be active at a time, which is all the decks need.

let interceptor = null;

// Register (or clear, with null) the function consulted on the next Next press.
// The function should return true if it consumed the press.
export function setPresentationNextInterceptor(fn) {
  interceptor = typeof fn === "function" ? fn : null;
}

// Called by PresentationProvider.next(). Returns true when the press was
// consumed by an interceptor and the deck should not advance this click.
export function consumePresentationNext() {
  if (typeof interceptor !== "function") return false;
  try {
    return interceptor() === true;
  } catch {
    return false;
  }
}
