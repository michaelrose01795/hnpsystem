// file location: src/components/ui/Button.js
// Standard button component using the .app-btn class system.
// Variants: primary (default), secondary, ghost, danger
// Sizes: default, sm, xs
// Shape: default (rounded), pill
//
// This component is the single source of truth for button appearance.
// Inline `style` overrides for visual properties (background, padding,
// borderRadius, font*, color, border*, boxShadow, height) are stripped
// so consumers cannot drift from the design system. Use a variant or size
// prop instead — or extend the global system in globals.css/theme.css.
import React from "react";

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

export default function Button({
  children,
  variant = "primary",
  size,
  pill = false,
  disabled = false,
  className = "",
  style,
  ...rest
}) {
  const classes = [
    "app-btn",
    `app-btn--${variant}`,
    size === "sm" && "app-btn--sm",
    size === "xs" && "app-btn--xs",
    pill && "app-btn--pill",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled} style={sanitizeStyle(style)} {...rest}>
      {children}
    </button>
  );
}
