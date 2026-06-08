// file location: src/components/customer-global/CustomerTable.js
// Customer table wrapper that keeps customer tables in one class family.
import React from "react";

export default function CustomerTable({
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
    <div className={`customer-table ${className}`.trim()} {...rest}>
      <div className="customer-table-scroll">
        <table className={`customer-table-element ${tableClassName}`.trim()}>
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
