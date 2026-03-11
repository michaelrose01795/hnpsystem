// file location: src/components/ui/Button.js
// Standard button component using the .app-btn class system.
// Variants: primary (default), secondary, ghost
// Sizes: default, sm, xs
// Shape: default (rounded), pill
import React from "react";

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
    <button className={classes} disabled={disabled} style={style} {...rest}>
      {children}
    </button>
  );
}
