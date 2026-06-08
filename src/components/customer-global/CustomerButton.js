// file location: src/components/customer-global/CustomerButton.js
// Reusable customer button wrapper. Customer styling is scoped through
// customer-global CSS and the /website global stylesheet.
import React from "react";
import Link from "next/link";

export default function CustomerButton({
  children,
  variant = "primary",
  href,
  className = "",
  prefetch = false,
  ...rest
}) {
  const classes = [
    "customer-button",
    `customer-button-${variant}`,
    variant === "secondary" && "app-btn",
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
