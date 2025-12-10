// file location: src/utils/exportUtils.js // header comment referencing file path
export function exportToCsv(filename, rows = [], columns = []) { // helper that triggers CSV download on the client
  if (typeof window === "undefined") {
    return;
  }
  const safeColumns = columns.length > 0 ? columns : Object.keys(rows[0] || {});
  const headerLine = safeColumns.join(",");
  const dataLines = rows.map((row) => {
    return safeColumns
      .map((column) => {
        const raw = row[column];
        const value = raw === undefined || raw === null ? "" : String(raw);
        const escaped = value.replace(/"/g, '""');
        return value.includes(",") || value.includes("\n") ? `"${escaped}"` : escaped;
      })
      .join(",");
  });
  const csvContent = [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
