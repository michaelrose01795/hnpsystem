// file location: src/components/staff-global/StaffTable.js
// Staff table wrapper. It keeps table shell classes consistent while allowing
// pages to keep their own row rendering and data logic.
import React from "react";

export default function StaffTable({
  columns = [],
  rows = [],
  children,
  className = "",
  tableClassName = "",
  emptyText = "No records to show",
  ...rest
}) {
  const hasStructuredRows = columns.length > 0 && rows.length > 0;

  return (
    <div className={`staff-table app-table-shell-wrap ${className}`.trim()} {...rest}>
      <div className="staff-table-scroll app-table-shell-scroll">
        <table className={`staff-table-element app-data-table app-table-shell ${tableClassName}`.trim()}>
          {children || (
            <>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key || column.accessor}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasStructuredRows ? rows.map((row, rowIndex) => (
                  <tr key={row.id || row.key || rowIndex}>
                    {columns.map((column) => (
                      <td key={column.key || column.accessor}>
                        {column.render ? column.render(row) : row[column.accessor || column.key]}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={Math.max(columns.length, 1)}>{emptyText}</td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}
