// file location: src/components/staff-global/StaffToolbar.js
// Staff toolbar wrapper for page filters and actions.
import React from "react";

export default function StaffToolbar({
  children,
  variant = "filter",
  className = "",
  ...rest
}) {
  return (
    <div className={`staff-toolbar app-toolbar-row app-toolbar--${variant} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
