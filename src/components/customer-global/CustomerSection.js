// file location: src/components/customer-global/CustomerSection.js
// Customer section wrapper for grouped customer UI content.
import React from "react";
import CustomerCard from "./CustomerCard";

export default function CustomerSection({
  title,
  subtitle,
  action,
  children,
  className = "",
  layer = "surface",
  ...rest
}) {
  return (
    <CustomerCard
      title={title}
      subtitle={subtitle}
      action={action}
      layer={layer}
      className={`customer-section ${className}`.trim()}
      as="section"
      {...rest}
    >
      {children}
    </CustomerCard>
  );
}
