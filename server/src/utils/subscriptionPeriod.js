export function subscriptionPeriod(currentEnd, validityDays, now = Date.now()) {
  const days = Number(validityDays);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Invalid subscription duration");
  const previous = currentEnd ? new Date(currentEnd).getTime() : 0;
  if (!Number.isFinite(previous)) throw new Error("Invalid subscription expiry");
  const periodStart = new Date(Math.max(now, previous));
  return { periodStart, periodEnd: new Date(periodStart.getTime() + days * 86400000) };
}
