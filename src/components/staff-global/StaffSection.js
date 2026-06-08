// file location: src/components/staff-global/StaffSection.js
// Staff section wrapper for grouped page content. It can render the nested
// theme layer when placed inside a StaffCard.
import React from "react";
import StaffCard from "./StaffCard";

export default function StaffSection({
  title,
  subtitle,
  action,
  children,
  className = "",
  layer = "surface",
  ...rest
}) {
  return (
    <StaffCard
      title={title}
      subtitle={subtitle}
      action={action}
      layer={layer}
      className={`staff-section ${className}`.trim()}
      as="section"
      {...rest}
    >
      {children}
    </StaffCard>
  );
}
