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

// Stockout dates must be reviewed evidence: zero sales alone cannot establish
// lost demand. Promotion uplift is a planner scenario, not a fitted causal claim.
export function scenarioForecast(daily, options = {}, now = new Date()) {
  forecastDemand(daily, options); // shared numeric validation
  const { stockoutDates = [], promotionMultiplier = 1, seasonalMultiplier = 1 } = options;
  for (const factor of [promotionMultiplier, seasonalMultiplier])
    if (!Number.isFinite(factor) || factor < 0.1 || factor > 5) fail('Scenario multipliers must be 0.1–5');
  if (!Array.isArray(stockoutDates) || stockoutDates.length > daily.length) fail('Invalid reviewed stockout dates');
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const first = today - (daily.length - 1) * 86400000;
  const excluded = new Set();
  for (const date of stockoutDates) {
    const time = Date.parse(date + 'T00:00:00Z'), index = (time - first) / 86400000;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(index) || index < 0 || index >= daily.length || new Date(time).toISOString().slice(0,10) !== date) fail('Stockout date must be a valid date in the analysis window');
    excluded.add(index);
  }
  const observed = daily.filter((_, i) => !excluded.has(i));
  if (observed.length < 7) fail('At least seven non-stockout days required');
  const average = observed.reduce((a,b) => a+b,0) / observed.length;
  const adjusted = daily.map((n,i) => excluded.has(i) ? Math.ceil(average) : n);
  const baseline = forecastDemand(adjusted, options);
  const weekday = Array.from({ length: 7 }, () => []);
  daily.forEach((n,i) => { if (!excluded.has(i)) weekday[new Date(first+i*86400000).getUTCDay()].push(n); });
  const useWeekday = weekday.every(values => values.length >= 4) && average > 0;
  const factors = weekday.map(values => useWeekday ? Math.min(3, Math.max(0.1, values.reduce((a,b)=>a+b,0)/values.length/average)) : 1);
  // Normalize capped weekday factors to avoid changing the total weekly level.
  const factorMean = factors.reduce((a,b)=>a+b,0)/7;
  const horizon = Array.from({ length: baseline.leadDays }, (_,i) => {
    const date = new Date(today+(i+1)*86400000);
    return { date: date.toISOString().slice(0,10), expected: baseline.recentDailyRate * factors[date.getUTCDay()]/factorMean * promotionMultiplier * seasonalMultiplier };
  });
  const expected = Math.ceil(horizon.reduce((sum, row) => sum+row.expected, 0));
  const statisticalSafety = Math.ceil(baseline.statisticalSafety * promotionMultiplier * seasonalMultiplier);
  const target = expected + Math.max(options.safety || 0, statisticalSafety);
  return { ...baseline, method: 'REVIEWED_SCENARIO_WEEKDAY', expected, statisticalSafety, target,
    suggested: Math.max(0,target-(options.stock||0)-(options.inTransit||0)),
    weekdaySeasonality: useWeekday, stockoutDays: excluded.size, imputedDailyDemand: Math.ceil(average),
    promotionMultiplier, seasonalMultiplier,
    horizon: horizon.map(row=>({...row,expected:Math.round(row.expected*100)/100})),
    limitations: 'Weekday pattern requires four observed weeks. Annual seasonality and promotion uplift are reviewed scenario inputs; stockout imputation is an estimate, not recorded sales.' };
}
