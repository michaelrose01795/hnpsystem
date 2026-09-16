// file location: src/components/ui/Button.js
// Standard button component using the .app-btn class system.
// Variants: primary (default), secondary, ghost, danger, theme
// Sizes: default, sm, xs
// Shape: default (rounded), pill
//
// This component is the single source of truth for button appearance.
// Inline `style` overrides for visual properties (background, padding,
// borderRadius, font*, color, border*, boxShadow, height) are stripped
// so consumers cannot drift from the design system. Use a variant or size
// prop instead — or extend the global system in staffglobal.css/theme.css.
import React from "react";
import { Symbol, resolveSymbolForLabel } from "./SymbolButton";

const DISALLOWED_STYLE_KEYS = new Set([
  "background", "backgroundColor", "backgroundImage",
  "color",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "paddingInline", "paddingInlineStart", "paddingInlineEnd",
  "paddingBlock", "paddingBlockStart", "paddingBlockEnd",
  "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
  "borderColor", "borderWidth", "borderStyle",
  "borderRadius", "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomLeftRadius", "borderBottomRightRadius",
  "font", "fontFamily", "fontSize", "fontWeight", "fontStyle",
  "boxShadow",
  "height", "minHeight",
]);

function sanitizeStyle(style) {
  if (!style || typeof style !== "object") return style;
  const cleaned = {};
  const dropped = [];
  for (const key of Object.keys(style)) {
    if (DISALLOWED_STYLE_KEYS.has(key)) {
      dropped.push(key);
      continue;
    }
    cleaned[key] = style[key];
  }
  if (dropped.length && process.env.NODE_ENV !== "production" && typeof console !== "undefined") {
    console.warn(
      `[Button] Dropped inline style key(s): ${dropped.join(", ")}. ` +
      `Visual properties belong to the global design system — use variant/size props instead.`
    );
  }
  return cleaned;
}

// Inline busy spinner. Uses `stroke` (not `border`) so it inherits the button's
// text colour across every variant and never trips the border ban. Rotation and
// reduced-motion handling live in families/buttons.css (.app-btn__spinner).
function ButtonSpinner() {
  return (
    <svg
      className="app-btn__spinner"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  children,
  variant = "primary",
  size,
  pill = false,
  busy = false,
  disabled = false,
  symbol,
  className = "",
  style,
  ...rest
}) {
  // A button is EITHER a symbol or words — never both. When a label names an
  // action the symbol set covers, the mark replaces the text entirely and the
  // words become the accessible name. Which labels qualify is decided in one
  // place, lib/ui/symbolLabels.js, so the whole app flips together.
  //
  // `symbol="name"` forces a mark onto a label the map does not cover;
  // `symbol={false}` keeps a button as words even if its label is mapped.
  const resolvedSymbol =
    symbol === false ? null : symbol || resolveSymbolForLabel(children, rest["aria-label"]);

  const classes = [
    "app-btn",
    `app-btn--${variant}`,
    size === "sm" && "app-btn--sm",
    size === "xs" && "app-btn--xs",
    size === "xxs" && "app-btn--xxs",
    pill && "app-btn--pill",
    busy && "is-busy",
    resolvedSymbol && "app-btn--has-symbol",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Losing the words must not lose the name: the label the symbol replaced
  // becomes aria-label (and the tooltip below), so the button still announces
  // itself and is still findable by its text in tests.
  const ariaLabel =
    rest["aria-label"] ||
    (resolvedSymbol && typeof children === "string" ? children.trim() : undefined);

  // `busy` disables the button (blocking double-submits) and announces the
  // pending state to assistive tech, while keeping the label visible next to
  // the spinner. Pair with useBusyAction to also guard re-entrant calls.
  return (
    <button
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      style={sanitizeStyle(style)}
      {...rest}
      data-symbol={resolvedSymbol || undefined}
      aria-label={ariaLabel}
      title={rest.title || (resolvedSymbol ? ariaLabel : undefined)}
    >
      {busy && <ButtonSpinner />}
      {/* The mark stands in for the children; a button without one keeps
          exactly the children it was given. */}
      {resolvedSymbol && !busy && <Symbol symbol={resolvedSymbol} className="app-btn__symbol" />}
      {!resolvedSymbol && children}
    </button>
  );
}
