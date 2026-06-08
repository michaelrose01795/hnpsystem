// file location: src/components/staff-global/StaffBadge.js
// Staff status badge wrapper using the global .app-badge tone classes.
import React from "react";

export default function StaffBadge({
  children,
  tone = "neutral",
  control = false,
  uppercase = false,
  className = "",
  ...rest
}) {
  const classes = [
    "staff-badge",
    `staff-badge-${tone}`,
    "app-badge",
    `app-badge--${tone}`,
    control && "app-badge--control",
    uppercase && "app-badge--uppercase",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
