import { tokenService } from "../services/tokenService.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function request(path, options = {}) {
  window.dispatchEvent(new Event("accessories-api-start"));
  const token = tokenService.getToken();
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
