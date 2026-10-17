// Pure Cutting management report calculations, testable without MongoDB.
import ApiError from "../utils/ApiError.js";

export function cuttingOverviewFilter(query = {}) {
  const planNo = String(query.planNo || "").trim().toUpperCase();
  if (planNo && !/^[A-Z0-9_/-]{1,100}$/.test(planNo))
    throw new ApiError(400, "Invalid Cutting Plan No filter");
  return planNo ? {planNo} : {};
}

const count = value => {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const weight = value => Number(count(value).toFixed(3));

export function cuttingOverviewRows(plans = [], actuals = [], assignments = []) {
  const actualMap = new Map(actuals.map(row => [String(row.planNo).toUpperCase(), row]));
  const machineMap = new Map();
  for (const entry of assignments) {
    const code = String(entry.planNo || "").toUpperCase();
    if (!machineMap.has(code)) machineMap.set(code, []);
    machineMap.get(code).push(entry);
  }
  return plans.map(plan => {
    const actual = actualMap.get(String(plan.planNo).toUpperCase());
    const targetPcs = count(plan.totalPlannedPcs);
    const actualPcs = count(actual?.totalActualPcs);
    const pendingPcs = Math.max(0, targetPcs - actualPcs);
    const machineRows = machineMap.get(String(plan.planNo).toUpperCase()) || [];
    const reportedWaste = count(actual?.wasteWeightKg);
    return {
      planNo: plan.planNo,
      dcNo: plan.dcNo,
      itemCode: plan.itemCode,
      itemName: plan.itemName,
      orderNo: plan.orderNo,
      planStatus: plan.status,
      actualStatus: actual?.status || "NOT_ENTERED",
      targetPcs,
      actualPcs,
      pendingPcs,
      completionPercent: targetPcs ? Number((Math.min(actualPcs / targetPcs, 1) * 100).toFixed(1)) : 0,
      targetWeightKg: weight(plan.totalWantedWeightKg),
      actualWeightKg: weight(actual?.totalActualWeightKg),
      wasteWeightKg: weight(reportedWaste),
      spreaderStatus: machineRows.filter(row => row.machineType === "SPREADER").map(row => row.status),
      cutterStatus: machineRows.filter(row => row.machineType === "CUTTER").map(row => row.status),
      createdAt: plan.createdAt,
    };
  });
}

export function cuttingOverviewSummary(rows) {
  return rows.reduce((summary, row) => ({
    plans: summary.plans + 1,
    targetPcs: summary.targetPcs + row.targetPcs,
    actualPcs: summary.actualPcs + row.actualPcs,
    pendingPcs: summary.pendingPcs + row.pendingPcs,
    wasteWeightKg: Number((summary.wasteWeightKg + row.wasteWeightKg).toFixed(3)),
    completedPlans: summary.completedPlans + (row.actualStatus === "COMPLETED" ? 1 : 0),
  }), {plans:0, targetPcs:0, actualPcs:0, pendingPcs:0, wasteWeightKg:0, completedPlans:0});
}
