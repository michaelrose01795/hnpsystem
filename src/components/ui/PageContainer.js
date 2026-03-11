// file location: src/components/ui/PageContainer.js
// Controls the page width and horizontal padding.
// Use inside PageWrapper for width-constrained content.
import React from "react";

export default function PageContainer({ children, className = "", style }) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: "var(--page-content-max-width)",
        margin: "0 auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
