export function supportRequestAllowed(method, originalUrl, scopes = []) {
  const path = String(originalUrl || "").split("?")[0];
  const match = path.match(/^\/api\/([a-z-]+)(?:\/|$)/);
  return method === "GET" && Boolean(match) && scopes.includes(match[1]);
}
