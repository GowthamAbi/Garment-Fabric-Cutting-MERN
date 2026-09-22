import CuttingMachinePlan from "../models/CuttingMachinePlan.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import Machine from "../models/Machine.js";
import ApiError from "../utils/ApiError.js";

const upper = (value) => String(value || "").trim().toUpperCase();
const active = ["READY", "RUNNING", "PAUSED", "BREAKDOWN", "CHANGE", "QUEUED"];

async function resequence(machineCode) {
  const rows = await CuttingMachinePlan.find({ machineCode, status: { $in: active } }).sort({ priority: 1, createdAt: 1 });
  let queue = 1;
  for (const row of rows) {
    if (row.status === "RUNNING") row.queuePosition = 0;
    else { row.queuePosition = queue; queue += 1; }
    await row.save();
  }
}

export async function listAssignments(req, res) {
  const filter = {};
  if (req.query.planNo) filter.planNo = upper(req.query.planNo);
  if (req.query.machineCode) filter.machineCode = upper(req.query.machineCode);
  if (req.query.machineType) filter.machineType = upper(req.query.machineType);
  res.json(await CuttingMachinePlan.find(filter).sort({ createdAt: -1 }));
}

export async function createAssignment(req, res) {
  const machineType = upper(req.body.machineType);
  const machineCode = upper(req.body.machineCode);
  const planNo = upper(req.body.planNo);
  const machine = await Machine.findOne({ machineCode });
  if (!machine) throw new ApiError(404, "Machine not found");
  if (upper(machine.machineType) !== machineType) throw new ApiError(409, `Select a ${machineType} machine`);
  if (machine.status === "Breakdown") throw new ApiError(409, "Breakdown machine cannot receive a plan");
  const plan = await FabricCutPlan.findOne({ $or: [{ planNo }, { dcNo: planNo }] });
  if (!plan) throw new ApiError(404, "Plan / DC not found");
  let upstream = null;
  if (machineType === "CUTTER") {
    upstream = await CuttingMachinePlan.findOne({ planNo: plan.planNo, machineType: "SPREADER", status: "PUBLISHED", colour: upper(req.body.colour), size: upper(req.body.size || "ALL") }).sort({ completedAt: -1 });
    const published = upstream || await CuttingMachinePlan.findOne({ planNo: plan.planNo, machineType: "SPREADER", status: "PUBLISHED" }).sort({ completedAt: -1 });
    if (!published) throw new ApiError(409, "Spreader must Publish this plan before Cutter assignment");
    upstream = published;
    if (await CuttingMachinePlan.exists({ upstreamAssignmentId: upstream._id })) throw new ApiError(409, "This Spreader work is already assigned to a Cutter");
  }
  const running = await CuttingMachinePlan.exists({ machineCode, status: "RUNNING" });
  const queueCount = await CuttingMachinePlan.countDocuments({ machineCode, status: { $in: active } });
  const status = running ? "QUEUED" : "RUNNING";
  const row = await CuttingMachinePlan.create({
    machineType, machineCode, planNo: plan.planNo, dcNo: plan.dcNo,
    colour: upper(req.body.colour), size: upper(req.body.size || "ALL"), pcs: Number(req.body.pcs),
    priority: Number(req.body.priority || queueCount + 1), queuePosition: running ? queueCount + 1 : 0,
    status, upstreamAssignmentId: upstream?._id, createdBy: req.user.name,
    events: [{ action: "ASSIGN", fromStatus: "", toStatus: status, machineCode, user: req.user.name }],
  });
  if (!running) { machine.status = "Running"; await machine.save(); }
  await resequence(machineCode);
  res.status(201).json(row);
}

export async function assignmentAction(req, res) {
  const row = await CuttingMachinePlan.findById(req.params.id);
  if (!row) throw new ApiError(404, "Machine plan not found");
  const action = upper(req.body.action);
  const fromStatus = row.status;
  const machine = await Machine.findOne({ machineCode: row.machineCode });
  if (!machine) throw new ApiError(404, "Machine not found");
  let cutterTarget = null;
  if (["COMPLETE", "PUBLISH", "FINISH"].includes(action) && row.machineType === "SPREADER") {
    const cutterMachines = await Machine.find({ machineType: { $regex: /^cutter$/i }, status: { $ne: "Breakdown" }, active: { $ne: false } });
    if (cutterMachines.length) {
      const loads = await Promise.all(cutterMachines.map(async (item) => ({ item, count: await CuttingMachinePlan.countDocuments({ machineCode: item.machineCode, status: { $in: active } }) })));
      cutterTarget = loads.sort((a, b) => a.count - b.count)[0];
    }
  }
  if (["START", "RESUME"].includes(action)) {
    const running = await CuttingMachinePlan.exists({ _id: { $ne: row._id }, machineCode: row.machineCode, status: "RUNNING" });
    if (running) throw new ApiError(409, "Another plan is already running on this machine");
    row.status = "RUNNING"; row.startedAt ||= new Date(); machine.status = "Running";
  } else if (action === "BREAKDOWN") {
    row.status = "BREAKDOWN"; machine.status = "Breakdown";
  } else if (["CHANGE", "BREAK"].includes(action)) {
    row.status = action === "CHANGE" ? "CHANGE" : "PAUSED"; machine.status = "Available";
  } else if (["COMPLETE", "PUBLISH", "FINISH"].includes(action)) {
    row.status = row.machineType === "SPREADER" ? "PUBLISHED" : "COMPLETED";
    row.completedAt = new Date(); machine.status = "Available";
  } else throw new ApiError(400, "Unsupported action");
  row.events.push({ action, fromStatus, toStatus: row.status, machineCode: row.machineCode, reason: req.body.reason || "", user: req.user.name });
  await row.save(); await machine.save(); await resequence(row.machineCode);
  if (cutterTarget && !(await CuttingMachinePlan.exists({ upstreamAssignmentId: row._id }))) {
    const running = await CuttingMachinePlan.exists({ machineCode: cutterTarget.item.machineCode, status: "RUNNING" });
    const cutterStatus = running ? "QUEUED" : "RUNNING";
    const cutterRow = await CuttingMachinePlan.create({
      machineType: "CUTTER", machineCode: cutterTarget.item.machineCode, planNo: row.planNo, dcNo: row.dcNo,
      colour: row.colour, size: row.size, pcs: row.pcs, priority: cutterTarget.count + 1,
      queuePosition: running ? cutterTarget.count + 1 : 0, status: cutterStatus,
      upstreamAssignmentId: row._id, startedAt: running ? undefined : new Date(), createdBy: req.user.name,
      events: [{ action: "FROM_SPREADER", fromStatus: "PUBLISHED", toStatus: cutterStatus, machineCode: cutterTarget.item.machineCode, user: req.user.name }],
    });
    if (!running) { cutterTarget.item.status = "Running"; await cutterTarget.item.save(); }
    await resequence(cutterRow.machineCode);
  }
  const next = await CuttingMachinePlan.findOne({ machineCode: row.machineCode, status: "QUEUED" }).sort({ queuePosition: 1, createdAt: 1 });
  if (next && ["PUBLISHED", "COMPLETED", "CHANGE", "PAUSED"].includes(row.status)) { next.status = "READY"; next.events.push({ action: "QUEUE_READY", fromStatus: "QUEUED", toStatus: "READY", machineCode: next.machineCode, user: req.user.name }); await next.save(); }
  res.json(row);
}

export async function transferAssignment(req, res) {
  const row = await CuttingMachinePlan.findById(req.params.id);
  const target = await Machine.findOne({ machineCode: upper(req.body.machineCode), status: { $ne: "Breakdown" } });
  if (!row || !target) throw new ApiError(404, "Assignment or target machine not found");
  if (upper(target.machineType) !== row.machineType) throw new ApiError(409, "Target machine type does not match");
  const oldMachine = row.machineCode, fromStatus = row.status; row.machineCode = target.machineCode; row.status = "QUEUED";
  row.events.push({ action: "TRANSFER", fromStatus, toStatus: "QUEUED", machineCode: target.machineCode, reason: req.body.reason || "", user: req.user.name });
  await row.save(); await resequence(oldMachine); await resequence(target.machineCode); res.json(row);
}

export async function machinePlanStatus(_req, res) {
  const [machines, assignments] = await Promise.all([Machine.find({ machineType: { $in: ["Cutter", "Spreader"] } }).sort({ machineType: 1, machineCode: 1 }).lean(), CuttingMachinePlan.find().sort({ createdAt: -1 }).lean()]);
  res.json(machines.map((machine) => ({ ...machine, assignments: assignments.filter((row) => row.machineCode === machine.machineCode) })));
}
