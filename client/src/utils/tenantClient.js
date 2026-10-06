export function companyKeyFromLocation() {
  const match = window.location.pathname.match(/^\/c\/([a-z0-9-]{3,40})(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || "platform";
}

export function tenantLoginPath(companyKey) {
  return companyKey && companyKey !== "platform"
    ? `/c/${companyKey}/login`
    : "/login";
}

