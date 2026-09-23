const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function api(path, options = {}) {
  window.dispatchEvent(new Event("accessories-api-start"));
  const token = localStorage.getItem("accessories_flow_token");
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("accessories-api-error", { detail: error.message }));
    throw error;
  } finally {
    window.dispatchEvent(new Event("accessories-api-end"));
  }
}

export function exportCsv(filename, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]).filter(
    (key) => !key.startsWith("_") && key !== "__v",
  );
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const groupedMachineReport = columns.includes("breakdownReason") && columns.includes("changeReason") && columns.includes("breakReason");
  const firstHeader = groupedMachineReport ? `<tr>${columns.map((column) => column === "breakdownReason" ? '<th colspan="4">Breakdown</th>' : column === "changeReason" ? '<th colspan="4">Change</th>' : column === "breakReason" ? '<th colspan="4">Break</th>' : ["breakdownStartTime", "breakdownEndTime", "breakdownDurationHours", "changeStartTime", "changeEndTime", "changeDurationHours", "breakStartTime", "breakEndTime", "breakDurationHours"].includes(column) ? "" : `<th rowspan="2">${escape(column)}</th>`).join("")}</tr>` : "";
  const secondHeader = `<tr>${columns.map((column) => groupedMachineReport && ["breakdownReason", "changeReason", "breakReason"].includes(column) ? "<th>Reason</th>" : groupedMachineReport && column.endsWith("StartTime") ? "<th>Start Time</th>" : groupedMachineReport && column.endsWith("EndTime") ? "<th>End Time</th>" : groupedMachineReport && column.endsWith("DurationHours") ? "<th>Duration Hours</th>" : groupedMachineReport ? "" : `<th>${escape(column)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escape(row[column])}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial}th,td{border:1px solid #000;padding:6px;text-align:center}th{background:#dbe4e1;font-weight:700}</style></head><body><table>${firstHeader}${secondHeader}${body}</table></body></html>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" }));
  link.download = filename.replace(/\.csv$/i, ".xls");
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportElementExcel(filename, elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#000}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:6px;text-align:center}th{font-weight:700;background:#dbe4e1}h1,h2,h3{text-align:center}</style></head><body>${element.outerHTML}</body></html>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" }));
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}
