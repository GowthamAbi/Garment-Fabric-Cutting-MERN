const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function request(path, options = {}) {
  window.dispatchEvent(new Event("accessories-api-start"));
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.dispatchEvent(new Event("ug-session-expired"));
    }
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent("accessories-api-error", { detail: error.message }),
    );
    throw error;
  } finally {
    window.dispatchEvent(new Event("accessories-api-end"));
  }
}
