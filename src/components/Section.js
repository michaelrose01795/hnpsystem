// file location: src/components/Section.js
import React from "react";

// Props: title = section title, children = content inside the section, className = extra styling
export default function Section({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div>{children}</div>
    </div>
  );
}
