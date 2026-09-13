import FabricInward from "../models/FabricInward.js";
import FabricOutward from "../models/FabricOutward.js";
import CuttingPlan from "../models/CuttingPlan.js";
import CuttingMachine from "../models/CuttingMachine.js";
import GarmentPurchaseOrder from "../models/GarmentPurchaseOrder.js";

export async function dashboard(request, response) {
  const tenant = { companyId: request.tenant.companyId, factoryId: request.tenant.factoryId };
  const [inwards, outwards, plans, machines, pos] = await Promise.all([
    FabricInward.find(tenant).lean(),
    FabricOutward.find(tenant).lean(),
    CuttingPlan.find(tenant).lean(),
    CuttingMachine.find(tenant).lean(),
    GarmentPurchaseOrder.find(tenant).lean(),
  ]);
  response.json({
    fabricAvailableKg: inwards.reduce((sum, row) => sum + row.availableWeightKg, 0),
    poPendingPieces: pos.reduce((sum, row) => sum + Math.max(0, row.orderPieces - row.deliveredPieces), 0),
    outwardReady: outwards.filter((row) => row.status === "READY").length,
    cuttingQueue: plans.filter((row) => row.overallStatus !== "COMPLETED").length,
    runningMachines: machines.filter((row) => row.status === "RUNNING").length,
    machineStatus: machines,
    queue: plans.sort((a, b) => a.priority - b.priority || new Date(a.requiredDate) - new Date(b.requiredDate)),
  });
}
