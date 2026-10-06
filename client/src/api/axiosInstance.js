const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://api.ugsaas.com/api");
import { companyKeyFromLocation } from "../utils/tenantClient.js";

export async function request(path, options = {}) {
  const {
    suppressGlobalError = false,
    suppressSessionExpired = false,
    ...fetchOptions
  } = options;

  window.dispatchEvent(new Event("accessories-api-start"));
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Company-Key": companyKeyFromLocation(),
        ...fetchOptions.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !suppressSessionExpired) {
      window.dispatchEvent(new Event("ug-session-expired"));
    }
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    if (!suppressGlobalError) {
      window.dispatchEvent(
        new CustomEvent("accessories-api-error", { detail: error.message }),
      );
    }
    throw error;
  } finally {
    window.dispatchEvent(new Event("accessories-api-end"));
  }
}
