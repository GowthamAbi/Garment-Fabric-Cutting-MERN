import { ceilingRatio, safeInteger, fail } from "./policy.js";
export const STAGES = ["FABRIC", "SPREADING", "CUTTING", "FOLDING", "ELASTIC", "STITCHING", "FINISHING", "PACKING"];
export const EVENTS = ["START", "PAUSE", "RESUME", "COMPLETE", "CANCEL"];
export function routing(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > STAGES.length || new Set(value).size !== value.length || value.some(s => !STAGES.includes(s))) fail("Select distinct production stages");
  if (!value.includes("CUTTING") || !value.includes("FOLDING") || value.at(-1) !== "PACKING") fail("Routing requires Cutting, Folding and final Packing");
  if (value.indexOf("CUTTING") > value.indexOf("FOLDING")) fail("Cutting must precede Folding");
  return value;
}
export function timeWindow(start, end) {
  const a = new Date(start), b = new Date(end);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b <= a || b - a > 7 * 86400000) fail("Schedule must be a valid interval of at most seven days");
  return { start: a, end: b };
}
export function overlap(a, b) { return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end); }
export function transition(job, event, now) {
  if (!EVENTS.includes(event.action)) fail("Invalid machine event");
  if (job.status === "COMPLETE") fail("Completed operation cannot change");
  if (job.lastEventAt && now < new Date(job.lastEventAt)) fail("Event clock precedes previous event");
  const elapsed = job.lastEventAt ? Math.max(0, now - new Date(job.lastEventAt)) : 0;
  const result = { status: job.status, runMs: job.runMs || 0, pauseMs: job.pauseMs || 0, lastEventAt: now };
  if (job.status === "RUNNING") result.runMs += elapsed;
  if (job.status === "PAUSED") result.pauseMs += elapsed;
  if (event.action === "CANCEL" && job.status === "PLANNED" && String(event.notes || "").trim()) result.status = "CANCELLED";
  else if (event.action === "START" && job.status === "PLANNED") result.status = "RUNNING";
  else if (event.action === "PAUSE" && job.status === "RUNNING") {
    if (!["BREAKDOWN", "CHANGEOVER", "TRANSFER", "MATERIAL", "OTHER"].includes(event.reason) || !String(event.notes || "").trim()) fail("Pause requires reason and notes");
    result.status = "PAUSED";
  } else if (event.action === "RESUME" && job.status === "PAUSED") result.status = "RUNNING";
  else if (event.action === "COMPLETE" && job.status === "RUNNING") result.status = "COMPLETE";
  else fail("Event is not valid for the current operation state");
  return result;
}
// Deterministic planning suggestion only; no reservation or stock write occurs.
export function materialPlan(workOrders, documents, balances, skus) {
  const needs = new Map();
  for (const wo of workOrders) {
    const id = String(wo._id || wo.id);
    const components = wo.metadata?.bom?.components || [];
    const linked = documents.filter(d => d.sourceId === id && !d.reversedBy);
    const complete = linked.filter(d => d.type === "PRODUCTION_RECEIPT").reduce((s,d) => s + d.lines[0].qty, 0);
    if (complete >= wo.lines[0].qty) continue;
    for (const c of components) {
      const consumed = linked.filter(d => d.type === "MATERIAL_ISSUE").flatMap(d => d.lines).filter(l => l.sku === c.sku).reduce((s,l) => s + l.qty, 0);
      const returned = linked.filter(d => d.type === "MATERIAL_RETURN").flatMap(d => d.lines).filter(l => l.sku === c.sku).reduce((s,l) => s + l.qty, 0);
      const required = Math.max(0, ceilingRatio(c.qty, wo.lines[0].qty, wo.metadata.bom.outputQty) - consumed + returned);
      needs.set(c.sku, safeInteger((needs.get(c.sku) || 0) + required));
    }
  }
  return [...needs].map(([sku, required]) => {
    const available = balances.filter(b => b.sku === sku && !b.location.startsWith("WIP") && !["QC", "REJECTED", "JOBWORK", "DELIVERY"].includes(b.location)).reduce((s,b) => safeInteger(s + b.qty), 0);
    const master = skus.find(s => s.code === sku);
    return { sku, unit: master?.unit, required, available, shortage: Math.max(0, required - available), minimumQty: master?.minimumQty || 0 };
  });
}
export function routeCapacity(route, jobs, stage) {
  const index = route.stages.indexOf(stage);
  if (index < 0) fail("Stage is not in this work order route");
  const limit = index === 0 ? route.qty : jobs.filter(j => j.stage === route.stages[index - 1] && j.status === "COMPLETE").reduce((s,j) => s + j.qty, 0);
  const assigned = jobs.filter(j => j.stage === stage && j.status !== "CANCELLED").reduce((s,j) => s + j.qty, 0);
  return { limit, assigned };
}
