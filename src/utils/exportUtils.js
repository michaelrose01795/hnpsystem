// file location: src/utils/exportUtils.js // header comment referencing file path
export function exportToCsv(filename, rows = [], columns = []) { // helper that triggers CSV download on the client
  if (typeof window === "undefined") { // guard to avoid running during SSR
    return; // exit early when executed on server
  } // close SSR guard
  const safeColumns = columns.length > 0 ? columns : Object.keys(rows[0] || {}); // use provided column order or derive from first row
  const headerLine = safeColumns.join(","); // compose CSV header row
  const dataLines = rows.map((row) => { // build CSV line per row
    return safeColumns // iterate across columns for each row
      .map((column) => { // map each column in order
        const raw = row[column]; // pull raw value for current column
        const value = raw === undefined || raw === null ? "" : String(raw); // convert undefined/null to empty string
        const escaped = value.replace(/"/g, '""'); // escape double quotes per CSV rules
        return value.includes(",") || value.includes("\n") ? `"${escaped}"` : escaped; // wrap fields containing commas/newlines with quotes
      }) // close map per column
      .join(","); // join values with commas
  }); // close dataLines array build
  const csvContent = [headerLine, ...dataLines].join("\n"); // combine header and data rows separated by newline
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); // create blob containing CSV data
  const link = document.createElement("a"); // create temp anchor element for download
  link.href = URL.createObjectURL(blob); // create object URL pointing to blob data
  link.download = filename; // set suggested filename for download
  document.body.appendChild(link); // insert link into DOM to allow click
  link.click(); // programmatically click link to trigger download
  document.body.removeChild(link); // remove link after click
  URL.revokeObjectURL(link.href); // release object URL resources
} // close exportToCsv function definition
