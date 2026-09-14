// file location: e2e/responsive/measure.js
//
// Shared phone-floor measurement for the staff and customer responsive gates.
//
// Both specs (phone-floor.spec.js, website-phone-floor.spec.js) run the same
// two checks against different design systems, so the detector lives here once.
// Keeping a single implementation matters: when the detector is wrong it is
// wrong in a way that makes a gate silently pass, and that must be fixed in one
// place rather than drifting between the two.
//
// WHAT IS MEASURED, AND WHY IT IS NOT "DOES THE PAGE SCROLL SIDEWAYS"
// ------------------------------------------------------------------
// Both design systems clip horizontal overflow rather than scrolling it
// (staffglobal.css sets overflow-x: clip/hidden and caps every div at
// max-width: 100%). Asserting on document.scrollWidth therefore produces a gate
// that can never fail. Over-wide content is not panned to — it is silently cut
// off and becomes unreachable, with nothing on screen indicating it exists.
// That is the real failure mode, so it is what we measure.

const TOUCH_FLOOR = 44;

/**
 * Measure a page at its current viewport size.
 *
 * Returns { clipped, touch, websiteScope, staffScope } where clipped and touch
 * are arrays of human-readable offender descriptions — "this page has 3
 * problems" is not actionable on its own; which elements they are, is.
 */
async function measurePhoneFloor(page, touchFloor = TOUCH_FLOOR) {
  return page.evaluate((floor) => {
    const describe = (el) => {
      const cls =
        typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`;
    };

    // Screen-reader-only text is CLIPPED ON PURPOSE — the standard recipe is a
    // 1x1 box with overflow hidden and clip-path inset(50%), which is exactly
    // the shape of a real clipping defect. Without this exemption every
    // .ws-sr-only / .sr-only label counts as unreachable content, which is both
    // wrong and drowns out the genuine offenders.
    const isVisuallyHidden = (el, rect, style) => {
      if (rect.width <= 1 || rect.height <= 1) return true;
      if (style.clipPath && style.clipPath !== 'none') return true;
      if (style.clip && style.clip !== 'auto') return true;
      // Invisible native-picker proxies: WebsiteNativeDateTimeInput keeps a real
      // <input type="date"> at opacity 0 with pointer-events: none so the
      // browser still owns the value, while a styled button is the visible
      // control. Measuring the proxy reports a 6x5 target that no one can tap.
      if (Number(style.opacity) === 0) return true;
      if (style.pointerEvents === 'none') return true;
      return false;
    };

    // A preview STAGE crops on purpose. .website-dev-stage on /website/dev is a
    // fixed-size viewport simulator that renders a component at one size inside
    // a smaller frame, so content wider than the frame is the feature, not a
    // defect - the same way an iframe or a device-mockup shell is not "clipping
    // unreachable content". Exempted by name rather than by shape, so a genuine
    // clip elsewhere is still caught.
    //
    // Touch targets are exempted inside a stage for the same reason: a stage
    // renders a component scaled down, so a control that is 44px on its real
    // route measures smaller here. Those components are covered on the routes
    // they actually ship on, which is where a user taps them.
    const isPreviewStage = (el) => el.closest('.website-dev-stage, .website-dev-frame, [data-preview-stage="true"]');

    // A checkbox or radio is almost never tapped on the box itself: it sits
    // inside a <label>, and the label is the hit area the browser routes the
    // tap to. custglobal.css deliberately draws an 18px box
    // (--website-check-size) inside a much larger label row, which is correct
    // and standard. Measuring the input alone reports every one of them as a
    // violation, so measure the effective target instead.
    const effectiveRect = (el, rect) => {
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute("type");
      if (tag !== "input" || (type !== "checkbox" && type !== "radio")) return rect;
      const label =
        el.closest("label") ||
        (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      return label ? label.getBoundingClientRect() : rect;
    };

    // A calendar DAY is a square cell sized by its grid, not a standalone
    // control - custglobal.css opts it out of the control system explicitly
    // ("Calendar grid buttons are sized by their cell"). It renders 40x40,
    // above the WCAG 2.5.8 AA floor, and forcing 44 would break the square.
    const isCalendarGridCell = (el) => el.classList.contains("calendar-api__day");

    const clipped = [];
    const touch = [];

    for (const el of document.body.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      if (el.closest('[aria-hidden="true"]')) continue;

      const hidden = isVisuallyHidden(el, rect, style);

      const overflowX = style.overflowX;
      const isClipping = overflowX === 'hidden' || overflowX === 'clip';
      // An ellipsis is a deliberate, signposted truncation — not a defect.
      const signposted = style.textOverflow === 'ellipsis';
      if (!hidden && isClipping && !signposted && !isPreviewStage(el) && el.scrollWidth > el.clientWidth + 1) {
        clipped.push(`${describe(el)} [content ${el.scrollWidth} > box ${el.clientWidth}]`);
      }

      const tag = el.tagName.toLowerCase();
      const interactive =
        /^(button|a|select|textarea)$/.test(tag) ||
        (tag === 'input' && !['hidden', 'submit', 'reset'].includes(el.getAttribute('type')));
      // WCAG 2.5.8 exempts a link whose size is constrained by the line-height
      // of the sentence it sits in. A display:inline anchor with text siblings
      // is exactly that, and enlarging it would break the paragraph it is part
      // of. An inline anchor that is the ONLY thing in its container is not a
      // sentence link — it is a control wearing a link, and it still counts.
      const inlineInSentence =
        tag === 'a' &&
        style.display === 'inline' &&
        el.parentElement &&
        el.parentElement.childNodes.length > 1;
      const hit = effectiveRect(el, rect);
      if (interactive && !hidden && !inlineInSentence && !isCalendarGridCell(el) && !isPreviewStage(el) && hit.height < floor) {
        touch.push(`${describe(el)} [${Math.round(hit.width)}x${Math.round(hit.height)}]`);
      }
    }

    return {
      clipped,
      touch,
      websiteScope: document.documentElement.classList.contains('website-scope'),
      staffScope: document.documentElement.classList.contains('staff-scope'),
    };
  }, touchFloor);
}

module.exports = { measurePhoneFloor, TOUCH_FLOOR };
