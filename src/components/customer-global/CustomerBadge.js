// file location: src/components/customer-global/CustomerBadge.js
// Customer status badge wrapper using customer-global tone classes.
import React from "react";

export default function CustomerBadge({
  children,
  tone = "neutral",
  className = "",
  ...rest
}) {
  return (
    <span className={`customer-badge customer-badge-${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
