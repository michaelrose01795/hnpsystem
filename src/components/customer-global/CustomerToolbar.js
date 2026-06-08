// file location: src/components/customer-global/CustomerToolbar.js
// Customer toolbar wrapper for filters and compact customer actions.
import React from "react";

export default function CustomerToolbar({
  children,
  className = "",
  ...rest
}) {
  return (
    <div className={`customer-toolbar ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
