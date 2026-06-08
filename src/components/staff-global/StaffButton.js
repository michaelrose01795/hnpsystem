// file location: src/components/staff-global/StaffButton.js
// Reusable staff button wrapper. It centralises staff button class names while
// preserving the existing .app-btn Liquid Glass button system.
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
    "staff-button",
    `staff-button-${variant}`,
    "app-btn",
    `app-btn--${variant}`,
    size === "sm" && "app-btn--sm",
    size === "xs" && "app-btn--xs",
    pill && "app-btn--pill",
    active && "is-active",
    className,
  ].filter(Boolean).join(" ");

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
