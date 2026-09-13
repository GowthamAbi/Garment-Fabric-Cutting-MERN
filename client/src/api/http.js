const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function api(path, options = {}) {
  window.dispatchEvent(new Event("api:start"));
  try {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(!isFormData && { "Content-Type": "application/json" }),
        "x-company-id": import.meta.env.VITE_COMPANY_ID,
        "x-factory-id": import.meta.env.VITE_FACTORY_ID,
        "x-user-name": "Garment User",
        "x-user-role": import.meta.env.VITE_USER_ROLE || "admin",
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("api:error", { detail: error.message }));
    throw error;
  } finally {
    window.dispatchEvent(new Event("api:end"));
  }
}

export function downloadCsv(name, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter((key) => !["_id", "__v"].includes(key));
  const value = (item) => typeof item === "object" ? JSON.stringify(item) : item ?? "";
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(value(row[key])).replaceAll('"', '""')}"`).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
