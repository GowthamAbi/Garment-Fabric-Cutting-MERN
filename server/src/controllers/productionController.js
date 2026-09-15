import Employee from "../models/Employee.js";
import Machine from "../models/Machine.js";
import Outward from "../models/Outward.js";
import Item from "../models/Item.js";
import PendingIssue from "../models/PendingIssue.js";
import ProductionJob from "../models/ProductionJob.js";
import SewingDelivery from "../models/SewingDelivery.js";
import SewingHold from "../models/SewingHold.js";
import ProductionPlan from "../models/ProductionPlan.js";
import WarehouseStock from "../models/WarehouseStock.js";
import CuttingDc from "../models/CuttingDc.js";
import Inward from "../models/Inward.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const normalize = (value) => String(value || "").trim().toUpperCase();

export async function getProductionSummary(_request, response) {
  const statusHistoryFrom = new Date();
  statusHistoryFrom.setDate(statusHistoryFrom.getDate() - 8);
  const [machines, jobs, pendingIssues, sewingDeliveries, plans, sewingHolds] = await Promise.all([
    Machine.find().sort({ machineCode: 1 }).lean(),
    ProductionJob.find({ startTime: { $gte: statusHistoryFrom } }).sort({ createdAt: -1 }).lean(),
    PendingIssue.find({ status: { $nin: ["Resolved", "Cancelled"] } }).sort({ priority: 1, createdAt: -1 }).lean(),
    SewingDelivery.find().sort({ deliveryDate: -1 }).limit(50).lean(),
    ProductionPlan.find().sort({ requiredDate: 1 }).limit(100).lean(),
    SewingHold.find({ status: "Active" }).sort({ createdAt: -1 }).lean(),
  ]);
  response.json({
    machines,
    jobs,
    pendingIssues,
    sewingDeliveries,
    plans,
    sewingHolds,
    counts: {
      running: machines.filter((entry) => entry.status === "Running").length,
      available: machines.filter((entry) => entry.status === "Available").length,
      breakdown: machines.filter((entry) => entry.status === "Breakdown").length,
      pending: pendingIssues.length,
      todayOkPcs: jobs.filter((entry) => new Date(entry.updatedAt).toDateString() === new Date().toDateString()).reduce((sum, entry) => sum + entry.okPcs, 0),
      todayPlannedPcs: plans.reduce((sum, plan) => sum + plan.colours.flatMap((line) => line.sizes).reduce((total, line) => total + line.requiredPcs, 0), 0),
      reworkPcs: jobs.reduce((sum, entry) => sum + entry.reworkPcs, 0),
      rejectionPcs: jobs.reduce((sum, entry) => sum + entry.rejectionPcs, 0),
      sewingHold: sewingHolds.reduce((sum, entry) => sum + entry.quantity, 0),
    },
  });
}

export async function getPlans(_request, response) {
  response.json(await ProductionPlan.find().sort({ requiredDate: 1, createdAt: -1 }));
}

export async function savePlan(request, response) {
  const data = {
    ...request.body,
    dcNo: normalize(request.body.dcNo),
    itemCode: normalize(request.body.itemCode),
    plannedMachine: normalize(request.body.plannedMachine),
    colours: (request.body.colours || []).map((line) => ({
      ...line,
      colour: normalize(line.colour),
      sizes: (line.sizes || []).map((size) => ({
        ...size,
        size: normalize(size.size),
        requiredPcs: Number(size.requiredPcs),
        measurement: Number(size.measurement),
        requiredMtr: Number(size.requiredPcs) * Number(size.measurement),
      })),
    })),
    createdBy: request.user?.name || "Planner",
  };
  if (!data.colours.length || data.colours.some((line) => !line.colour || !line.sizes.length)) {
    throw new ApiError(400, "At least one colour and size plan is required");
  }
  const sizeCount = data.colours.reduce((sum, line) => sum + line.sizes.length, 0);
  if (sizeCount > 10) throw new ApiError(400, "Maximum 10 size lines are allowed per plan");
  if (data.colours.some((line) => line.sizes.some((size) => !size.size || size.requiredPcs <= 0 || size.measurement <= 0))) {
    throw new ApiError(400, "Every size needs valid PCS and measurement");
  }
  const outwardRows = await Outward.find({ dcNo: data.dcNo, itemCode: data.itemCode }).lean();
  for (const colourLine of data.colours) {
    const availableMtr = outwardRows.filter((row) => normalize(row.colour) === colourLine.colour).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const wantedMtr = colourLine.sizes.reduce((sum, size) => sum + size.requiredMtr, 0);
    if (wantedMtr > availableMtr) throw new ApiError(409, `${colourLine.colour}: wanted ${wantedMtr.toFixed(2)} MTR, but outward has only ${availableMtr.toFixed(2)} MTR`);
  }
  const plan = request.params.id
    ? await ProductionPlan.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await ProductionPlan.create({ ...data, planNo: generateReferenceNo("PLN") });
  if (!plan) throw new ApiError(404, "Production plan not found");
  response.status(request.params.id ? 200 : 201).json(plan);
}

export async function getMachines(_request, response) {
  response.json(await Machine.find().sort({ machineCode: 1 }));
}

export async function saveMachine(request, response) {
  const data = { ...request.body, machineCode: normalize(request.body.machineCode) };
  const machine = request.params.id
    ? await Machine.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await Machine.create(data);
  if (!machine) throw new ApiError(404, "Machine not found");
  response.status(request.params.id ? 200 : 201).json(machine);
}

export async function getEmployees(_request, response) {
  response.json(await Employee.find().sort({ employeeCode: 1 }));
}

export async function saveEmployee(request, response) {
  const data = { ...request.body, employeeCode: normalize(request.body.employeeCode) };
  const employee = request.params.id
    ? await Employee.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await Employee.create(data);
  if (!employee) throw new ApiError(404, "Employee not found");
  response.status(request.params.id ? 200 : 201).json(employee);
}

export async function getJobs(_request, response) {
  response.json(await ProductionJob.find().sort({ createdAt: -1 }));
}

export async function getDcPlan(request, response) {
  const dcNo = normalize(request.params.dcNo);
  const outwards = await Outward.find({ dcNo: { $regex: `^${dcNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).lean();
  if (!outwards.length) throw new ApiError(404, "DC number not found");
  const itemCodes = [...new Set(outwards.map((entry) => entry.itemCode))];
  const items = await Item.find({ itemCode: { $in: itemCodes } }).lean();
  const itemMap = new Map(items.map((item) => [item.itemCode, item]));
  const rows = outwards.map((entry) => ({
    ...entry,
    colour: entry.colour || itemMap.get(entry.itemCode)?.colour || "UNSPECIFIED",
    description: itemMap.get(entry.itemCode)?.description || entry.itemName || entry.itemCode,
  }));
  const cuttingDc = await CuttingDc.findOne({ dcNo }).lean();
  response.json({
    dcNo: outwards[0].dcNo,
    section: outwards[0].section,
    itemNames: [...new Set(rows.map((entry) => entry.itemName).filter(Boolean))],
    colours: [...new Set(rows.map((entry) => entry.colour))],
    rows,
    cuttingDc,
  });
}

export async function startJob(request, response) {
  const dcNo = normalize(request.body.dcNo);
  const requestedOutwardNo = normalize(request.body.outwardNo);
  const requestedColour = normalize(request.body.colour);
  const machineCode = normalize(request.body.machineCode);
  const employeeCode = normalize(request.body.employeeCode);
  const [dcOutwards, machine, employee] = await Promise.all([
    Outward.find(dcNo ? { dcNo: { $regex: `^${dcNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } } : { outwardNo: requestedOutwardNo }),
    Machine.findOne({ machineCode, active: true }),
    Employee.findOne({ employeeCode, active: true }),
  ]);
  if (!dcOutwards.length) throw new ApiError(404, "Main DC QR / number not found");
  if (!machine) throw new ApiError(404, "Machine QR / code not found");
  if (!employee) throw new ApiError(404, "Employee QR / code not found");
  if (machine.status !== "Available") throw new ApiError(409, `Machine is ${machine.status}`);

  const itemCodes = [...new Set(dcOutwards.map((entry) => entry.itemCode))];
  const items = await Item.find({ itemCode: { $in: itemCodes } }).lean();
  const itemMap = new Map(items.map((item) => [item.itemCode, item]));
  const outward = requestedOutwardNo
    ? dcOutwards.find((entry) => normalize(entry.outwardNo) === requestedOutwardNo)
    : dcOutwards.find((entry) =>
        normalize(entry.colour || itemMap.get(entry.itemCode)?.colour) === requestedColour,
      );
  if (!outward) throw new ApiError(404, "Selected colour is not available in this DC");
  if (requestedColour && normalize(outward.colour || itemMap.get(outward.itemCode)?.colour) !== requestedColour) {
    throw new ApiError(400, "Scanned outward row and selected colour do not match");
  }
  const outwardNo = outward.outwardNo;
  const productionDcNo = outward.dcNo;
  const cuttingDc = await CuttingDc.findOne({ dcNo: productionDcNo }).lean();
  const cuttingColour = cuttingDc?.colours?.find((line) => normalize(line.colour) === requestedColour);
  const sizes = cuttingColour?.sizes?.length ? cuttingColour.sizes.map((line) => normalize(line.size)) : String(request.body.size || "").split(",").map(normalize).filter(Boolean);
  const pieceValues = cuttingColour?.sizes?.length ? cuttingColour.sizes.map((line) => Number(line.pcs)) : String(request.body.plannedPcs || "").split(",").map((value) => Number(value.trim()));
  if (!sizes.length) throw new ApiError(400, "At least one size is required");
  if (sizes.length !== pieceValues.length) throw new ApiError(400, "Each size must have one matching PCS quantity");
  if (pieceValues.some((value) => !Number.isFinite(value) || value <= 0)) throw new ApiError(400, "Every planned PCS quantity must be greater than zero");
  const sizePlan = sizes.map((size, index) => ({ size, plannedPcs: pieceValues[index] }));
  const plannedPcs = pieceValues.reduce((sum, value) => sum + value, 0);

  const job = await ProductionJob.create({
    jobNo: generateReferenceNo("PRD"),
    outwardNo,
    dcNo: productionDcNo,
    itemCode: outward.itemCode,
    itemName: outward.itemName,
    section: request.body.section || outward.section || "Elastic Production",
    colour: requestedColour,
    size: sizes.join(", "),
    sizePlan,
    plannedPcs,
    planNo: normalize(request.body.planNo),
    shift: request.body.shift || "General",
    balancePcs: plannedPcs,
    machineCode,
    employeeCode,
    createdBy: request.user?.name || "Production User",
  });
  machine.status = "Running";
  await machine.save();
  response.status(201).json(job);
}

export async function stopJob(request, response) {
  const job = await ProductionJob.findById(request.params.id);
  if (!job) throw new ApiError(404, "Production job not found");
  const machine = await Machine.findOne({ machineCode: job.machineCode });
  const action = request.body.action;
  const allowed = ["Complete", "Breakdown", "Thread Change", "Bobbin Change", "Box Change", "Size Change", "Other Change"];
  if (!allowed.includes(action)) throw new ApiError(400, "Select a valid stop action");

  if (action === "Complete") {
    const sizeResults = (request.body.sizeResults?.length ? request.body.sizeResults : [{ size: job.size, okPcs: request.body.okPcs, reworkPcs: request.body.reworkPcs, rejectionPcs: request.body.rejectionPcs }]).map((row) => ({
      size: normalize(row.size), okPcs: Number(row.okPcs || 0), reworkPcs: Number(row.reworkPcs || 0), rejectionPcs: Number(row.rejectionPcs || 0),
    }));
    for (const result of sizeResults) {
      if ([result.okPcs, result.reworkPcs, result.rejectionPcs].some((value) => !Number.isFinite(value) || value < 0)) throw new ApiError(400, `${result.size}: quantities cannot be negative`);
      const sizePlan = job.sizePlan.find((line) => normalize(line.size) === result.size);
      if (sizePlan) {
        const previous = job.completionBySize.filter((line) => normalize(line.size) === result.size).reduce((sum, line) => sum + line.okPcs + line.reworkPcs + line.rejectionPcs, 0);
        if (result.okPcs + result.reworkPcs + result.rejectionPcs > sizePlan.plannedPcs - previous) throw new ApiError(400, `${result.size}: output exceeds size balance`);
      }
    }
    const ok = sizeResults.reduce((sum, row) => sum + row.okPcs, 0);
    const rework = sizeResults.reduce((sum, row) => sum + row.reworkPcs, 0);
    const rejection = sizeResults.reduce((sum, row) => sum + row.rejectionPcs, 0);
    if (ok + rework + rejection > job.balancePcs) throw new ApiError(400, "Output exceeds production balance");
    job.okPcs += ok;
    job.reworkPcs += rework;
    job.rejectionPcs += rejection;
    job.balancePcs = Math.max(0, job.plannedPcs - job.okPcs - job.reworkPcs - job.rejectionPcs);
    job.status = job.balancePcs === 0 ? "Completed" : "Partially Completed";
    job.stopTime = new Date();
    job.remarks = request.body.remarks || "";
    job.completionBySize.push(...sizeResults);
    if (machine) machine.status = "Available";
    const warehouseRows = sizeResults.flatMap((row) => [
      ["PRODUCTION_READY", "RDY", row.okPcs], ["REWORK", "RW", row.reworkPcs], ["REJECTION", "REJ", row.rejectionPcs],
    ].filter(([, , quantity]) => quantity > 0).map(([warehouseType, prefix, quantity]) => ({
      referenceNo: generateReferenceNo(prefix), warehouseType, jobNo: job.jobNo,
      dcNo: job.dcNo, outwardNo: job.outwardNo, itemCode: job.itemCode,
      itemName: job.itemName, colour: job.colour, size: row.size,
      originalQty: quantity, balanceQty: quantity,
      createdBy: request.user?.name || "Production User",
    })));
    if (warehouseRows.length) await WarehouseStock.insertMany(warehouseRows);
    if (job.status === "Completed") {
      const cutting = await CuttingDc.findOne({ dcNo: job.dcNo });
      const colourPlan = cutting?.colours?.find((line) => normalize(line.colour) === normalize(job.colour));
      const pickedRows = await Outward.find({ dcNo: job.dcNo, itemCode: job.itemCode }).lean();
      const pickedMtr = pickedRows.filter((row) => normalize(row.colour) === normalize(job.colour)).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const usedMtr = (colourPlan?.sizes || []).reduce((sum, plan) => {
        const completed = job.completionBySize.filter((row) => normalize(row.size) === normalize(plan.size)).reduce((total, row) => total + Number(row.okPcs || 0) + Number(row.reworkPcs || 0) + Number(row.rejectionPcs || 0), 0);
        return sum + completed * Number(plan.measurement || 0);
      }, 0);
      const remainingMtr = Number(Math.max(0, pickedMtr - usedMtr).toFixed(3));
      if (remainingMtr > 0 && !await WarehouseStock.exists({ warehouseType: "BALANCE_ELASTIC", jobNo: job.jobNo })) {
        await WarehouseStock.create({ referenceNo: generateReferenceNo("BAL"), warehouseType: "BALANCE_ELASTIC", jobNo: job.jobNo, dcNo: job.dcNo, outwardNo: job.outwardNo, itemCode: job.itemCode, itemName: job.itemName, colour: job.colour, size: "MTR", originalQty: remainingMtr, balanceQty: remainingMtr, unit: "MTR", reason: "Automatic balance after production completion", createdBy: request.user?.name || "Production User" });
      }
      if (cutting && colourPlan) {
        colourPlan.status = "COMPLETED";
        cutting.status = cutting.colours.every((line) => line.status === "COMPLETED") ? "COMPLETED" : "PARTIAL";
        await cutting.save();
      }
    }
  } else {
    job.status = action;
    job.events.push({ type: action, reason: request.body.reason || "", startTime: new Date() });
    if (machine) machine.status = action;
  }
  await job.save();
  if (machine) await machine.save();
  response.json(job);
}

export async function resumeJob(request, response) {
  const job = await ProductionJob.findById(request.params.id);
  if (!job) throw new ApiError(404, "Production job not found");
  const activeEvent = [...job.events].reverse().find((entry) => !entry.stopTime);
  if (activeEvent) activeEvent.stopTime = new Date();
  job.status = "Running";
  await job.save();
  await Machine.findOneAndUpdate({ machineCode: job.machineCode }, { status: "Running" });
  response.json(job);
}

export async function getPendingIssues(_request, response) {
  const issues = await PendingIssue.find().sort({ createdAt: -1 });
  for (const issue of issues) {
    if (issue.issueType !== "Material Shortage" || ["Resolved", "Cancelled"].includes(issue.status)) continue;
    const inwardExists = await Inward.exists({ itemCode: issue.itemCode, colour: issue.colour, balanceQty: { $gt: 0 } });
    if (inwardExists && issue.status !== "Material Received") { issue.status = "Material Received"; await issue.save(); }
  }
  response.json(issues);
}

export async function savePendingIssue(request, response) {
  const shortageMtr = Math.max(0, Number(request.body.requiredMtr || 0) - Number(request.body.availableMtr || 0));
  const data = { ...request.body, shortageMtr, createdBy: request.user?.name || "Production User" };
  const issue = request.params.id
    ? await PendingIssue.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await PendingIssue.create({ ...data, issueNo: generateReferenceNo("PND") });
  if (!issue) throw new ApiError(404, "Pending issue not found");
  response.status(request.params.id ? 200 : 201).json(issue);
}

export async function changeIssueStatus(request, response) {
  const status = request.body.status;
  const issue = await PendingIssue.findByIdAndUpdate(
    request.params.id,
    { status, ...(status === "Resolved" && { resolvedAt: new Date() }) },
    { new: true, runValidators: true },
  );
  if (!issue) throw new ApiError(404, "Pending issue not found");
  response.json(issue);
}

export async function deletePendingIssue(request, response) {
  const issue = await PendingIssue.findById(request.params.id);
  if (!issue) throw new ApiError(404, "Pending issue not found");
  if (issue.status !== "Material Received" && request.user?.role !== "saas_super_admin") throw new ApiError(409, "Delete is allowed after material is received");
  await issue.deleteOne();
  response.json({ message: "Pending request deleted" });
}

export async function getSewingHolds(_request, response) {
  response.json(await SewingHold.find().sort({ createdAt: -1 }));
}

export async function saveSewingHold(request, response) {
  const hold = await SewingHold.create({
    ...request.body,
    outwardNo: normalize(request.body.outwardNo),
    colour: normalize(request.body.colour),
    size: normalize(request.body.size),
    holdNo: generateReferenceNo("HLD"),
    createdBy: request.user?.name || "Sewing Coordinator",
  });
  response.status(201).json(hold);
}

export async function resolveSewingHold(request, response) {
  const hold = await SewingHold.findByIdAndUpdate(request.params.id, { status: request.body.status || "Resolved", resolvedAt: new Date() }, { new: true });
  if (!hold) throw new ApiError(404, "Sewing hold not found");
  response.json(hold);
}

export async function getSewingDeliveries(_request, response) {
  response.json(await SewingDelivery.find().sort({ deliveryDate: -1 }));
}

export async function createSewingDelivery(request, response) {
  const outwardNo = normalize(request.body.outwardNo);
  const colour = normalize(request.body.colour);
  const size = normalize(request.body.size);
  const readyRows = await WarehouseStock.find({ warehouseType: "PRODUCTION_READY", outwardNo, colour, size, balanceQty: { $gt: 0 } }).sort({ createdAt: 1 });
  const available = readyRows.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0);
  const quantity = Number(request.body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > available) {
    throw new ApiError(400, `Only ${Math.max(0, available)} OK pcs available for sewing`);
  }
  const delivery = await SewingDelivery.create({
    ...request.body,
    outwardNo,
    colour,
    size,
    quantity,
    deliveryNo: generateReferenceNo("SEW"),
    createdBy: request.user?.name || "Production User",
  });
  let remaining = quantity;
  for (const stock of readyRows) {
    const moved = Math.min(stock.balanceQty, remaining);
    stock.balanceQty -= moved;
    stock.history.push({ action: "SEWING_DELIVERY", quantity: moved, fromType: "PRODUCTION_READY", toType: "SEWING", sectionCode: request.body.sewingName, user: request.user?.name || "Production User" });
    await stock.save();
    remaining -= moved;
    if (remaining === 0) break;
  }
  response.status(201).json(delivery);
}
