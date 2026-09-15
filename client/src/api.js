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
