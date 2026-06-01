// file location: src/components/ui/StaffButton.js
// Staff button built on the shared `.app-btn` class system in staffglobal.css.
// Single component for both real buttons and link-styled buttons (a common
// staff-page need), so callers stop hand-writing `className="app-btn ..."`.
//
// Variants: primary (default) | secondary | ghost | danger | nav
// Sizes:    default | sm | xs        Shape: default | pill
//
// Pass `href` to render a Next.js <Link> styled as a button; otherwise a
// <button>. Visual styling lives in the global design system — use variant/size
// props rather than inline colour/border/padding overrides.
import React from "react";
import Link from "next/link";

export default function StaffButton({
  children,
  variant = "primary",
  size,
  pill = false,
  active = false,
  href,
  className = "",
  prefetch = false,
  ...rest
}) {
  const classes = [
    "app-btn",
    `app-btn--${variant}`,
    size === "sm" && "app-btn--sm",
    size === "xs" && "app-btn--xs",
    pill && "app-btn--pill",
    active && "is-active",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} prefetch={prefetch} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
