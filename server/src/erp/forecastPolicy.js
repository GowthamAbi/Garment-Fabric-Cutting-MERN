import { fail } from './policy.js';

// Explainable planning estimate. Never creates orders or reserves inventory.
export function forecastDemand(daily, { leadDays = 14, safety = 0, stock = 0, inTransit = 0, serviceLevel = 95 } = {}) {
  if (!Array.isArray(daily) || daily.length < 7 || daily.length > 365 || daily.some(n => !Number.isSafeInteger(n) || n < 0 || n > 100000000)) fail('Forecast requires 7–365 daily non-negative whole-piece totals');
  if (![leadDays, safety, stock, inTransit].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000) || leadDays > 365) fail('Invalid forecast stock or lead time');
  const z = {90: 1.282, 95: 1.645, 99: 2.326}[serviceLevel];
  if (!z) fail('Forecast service level must be 90, 95 or 99');
  const mean = daily.reduce((a,b) => a+b,0) / daily.length;
  const recent = daily.slice(-Math.min(28, daily.length));
  let smoothed = recent[0];
  for (const n of recent.slice(1)) smoothed = 0.2*n + 0.8*smoothed;
  const variance = daily.reduce((a,n) => a+(n-mean)**2,0)/Math.max(1,daily.length-1);
  // Blend recent movement with full-period baseline to damp single-day spikes.
  const rate = (mean + smoothed) / 2;
  const expected = Math.ceil(rate * leadDays);
  const statisticalSafety = Math.ceil(z * Math.sqrt(variance * leadDays));
  const target = expected + Math.max(safety, statisticalSafety);
  return { method:'BASELINE_EWMA', observations:daily.length, dailyMean:Math.round(mean*100)/100,
    recentDailyRate:Math.round(smoothed*100)/100, leadDays, serviceLevel, expected,
    statisticalSafety, target, suggested:Math.max(0,target-stock-inTransit),
    reliability:daily.length<28?'SHORT_HISTORY':daily.filter(n=>n>0).length<daily.length/4?'INTERMITTENT':'BASELINE',
    limitations:'Estimate uses historical net sales; stockouts, promotions and seasonality require planner review.' };
}

export function dailyNetSales(rows, days, now = new Date()) {
  if (!Number.isInteger(days) || days < 7 || days > 365) fail('Forecast days must be 7–365');
  const today = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const first = today - (days-1)*86400000, out=Array(days).fill(0);
  for (const row of rows) {
    const t=new Date(row.createdAt).getTime();
    const i=Math.floor((t-first)/86400000);
    if(i<0||i>=days) continue;
    const net=row.quantity-(row.returned||0);
    if(!Number.isSafeInteger(net)||net<0)fail('Invalid sale/return quantity in forecast');
    out[i]+=net;
    if(!Number.isSafeInteger(out[i]))fail('Forecast quantity exceeds capacity');
  }
  return out;
}
