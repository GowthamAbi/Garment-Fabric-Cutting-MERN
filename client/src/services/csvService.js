export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]).filter(
    (key) => !key.startsWith("_") && key !== "__v",
  );
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function downloadExcel(filename, rows) {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    .filter((key) => !key.startsWith("_") && key !== "__v");
  const cell = (value, header = false) => `<Cell${header ? ' ss:StyleID="Header"' : ""}><Data ss:Type="String">${escapeXml(typeof value === "object" ? JSON.stringify(value) : value)}</Data></Cell>`;
  const worksheetRows = [
    `<Row>${columns.map((column) => cell(column, true)).join("")}</Row>`,
    ...rows.map((row) => `<Row>${columns.map((column) => cell(row[column])).join("")}</Row>`),
  ].join("");
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#125C4B" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Reports"><Table>${worksheetRows}</Table></Worksheet></Workbook>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}
