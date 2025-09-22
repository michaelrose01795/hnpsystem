// file location: src/components/Section.js
import React from "react";

/**
 * A reusable card/section component for dashboard/widgets
 * Props:
 * - title: section title
 * - children: content inside the widget
 * - className: optional extra Tailwind classes
 */
export default function Section({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md border border-gray-200 p-4 flex flex-col ${className}`}
    >
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div className="flex-1">{children}</div>
    </div>
  );
}
