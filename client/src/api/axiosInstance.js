import { resolveApiEndpoint } from "../utils/apiEndpointPolicy.mjs";
// Fail closed in previews unless a non-production API is explicitly configured.
const API_URL=resolveApiEndpoint({
  hostname:window.location.hostname,
  configuredUrl:import.meta.env.VITE_API_URL
});
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
    if (!response.ok) { const error = new Error(data.message || "Request failed"); error.status = response.status; throw error; }
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
