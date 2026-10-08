import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ErpMachine, ErpRoute, ErpOperation, ErpOperationEvent, ErpRoll, ErpMaintenance, OPERATION_MODELS } from "./operationsModels.js";
import { ErpDocument, ErpBalance, ErpSku, ErpSettings } from "./models.js";
import { workspaceFilter, requestHash } from "./service.js";
import { authorizeErp, fail, quantity } from "./policy.js";
import { STAGES, routing, timeWindow, transition, materialPlan, routeCapacity } from "./operationsPolicy.js";
const router = Router();
const gate = action => (req,_res,next) => authorizeErp(req.user,action) ? next() : next(new ApiError(403,"ERP permission denied"));
const actor = req => req.user.userId || String(req.user._id);
const id = value => { if (!mongoose.isValidObjectId(value)) fail("Invalid record ID"); return String(value); };
const code = value => { const v = String(value || "").trim().toUpperCase(); if (!/^[A-Z0-9_-]{2,60}$/.test(v)) fail("Use a 2–60 character code"); return v; };
const text = (v,n=500) => String(v || "").trim().slice(0,n);
const key = req => { const k = req.get("Idempotency-Key"); if (!/^[A-Za-z0-9_-]{16,100}$/.test(k || "")) fail("Idempotency-Key is required"); return k; };
async function workOrder(scope, value, session) {
  const wo = await ErpDocument.findOne({ ...scope, _id: id(value), type: "WORK_ORDER", reversedBy: { $exists: false } }).session(session || null).lean();
  if (!wo) fail("An active work order is required"); return wo;
}
async function transaction(callback) {
  const scope = workspaceFilter(); await Promise.all(OPERATION_MODELS.map(m => m.init()));
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const setting = await ErpSettings.findOneAndUpdate({ ...scope,key: "ERP",enabled: true }, { $inc: { revision: 1 } }, { session,new: true });
      if (!setting) fail("Activate reviewed ERP before shop-floor entries");
      result = await callback(scope,session);
    }); return result;
  } finally { await session.endSession(); }
}
router.use(gate("read"));
router.get("/dashboard",asyncHandler(async (_req,res) => {
  const scope=workspaceFilter();
  const [machines,routes,operations,rolls,orders] = await Promise.all([
    ErpMachine.find(scope).limit(2000).lean(),ErpRoute.find(scope).limit(2000).lean(),
    ErpOperation.find(scope).sort({ start: -1 }).limit(2000).lean(),ErpRoll.find(scope).limit(2000).lean(),
    ErpDocument.find({ ...scope,type: "WORK_ORDER",reversedBy: { $exists: false } }).sort({ date: -1 }).limit(2000).select("number lines metadata sourceId date").lean(),
  ]);
  res.json({ stages: STAGES,machines,routes,operations,rolls,orders,limit: 2000 });
}));
router.post("/machines",gate("masters"),asyncHandler(async (req,res) => {
  if (!STAGES.includes(req.body.stage) || !text(req.body.name)) fail("Machine name and stage required");
  res.status(201).json(await transaction(async (scope,session) => (await ErpMachine.create([{ ...scope,code: code(req.body.code),name: text(req.body.name,100),stage: req.body.stage }],{ session }))[0]));
}));
router.post("/routing",gate("post"),asyncHandler(async (req,res) => {
  const stages = routing(req.body.stages);
  res.json(await transaction(async (scope,session) => {
    const wo = await workOrder(scope,req.body.workOrderId,session);
    const existing = await ErpRoute.findOne({ ...scope,workOrderId: String(wo._id) }).session(session).lean();
    if (existing) { if (JSON.stringify(existing.stages)!==JSON.stringify(stages)) fail("Routing is frozen; existing route differs"); return existing; }
    return (await ErpRoute.create([{ ...scope,workOrderId: String(wo._id),stages,qty: wo.lines[0].qty,createdBy: actor(req) }],{ session }))[0];
  }));
}));
router.post("/operations",gate("post"),asyncHandler(async (req,res) => {
  const input = { workOrderId: id(req.body.workOrderId),machineCode: code(req.body.machineCode),stage: req.body.stage,qty: quantity(req.body.quantity),...timeWindow(req.body.start,req.body.end) };
  const requestKey=key(req), hash=requestHash(input);
  res.json(await transaction(async (scope,session) => {
    const existing=await ErpOperation.findOne({ ...scope,key: requestKey }).session(session).lean();
    if (existing) { if(existing.requestHash!==hash) fail("Idempotency key has different schedule data"); return existing; }
    await workOrder(scope,input.workOrderId,session);
    const route=await ErpRoute.findOne({ ...scope,workOrderId: input.workOrderId }).session(session).lean();
    if (!route) fail("Create work order routing first");
    const machine=await ErpMachine.findOne({ ...scope,code: input.machineCode,stage: input.stage,active: true }).session(session);
    if (!machine) fail("Machine does not match stage");
    const jobs=await ErpOperation.find({ ...scope,workOrderId: input.workOrderId }).session(session).lean();
    const {limit,assigned}=routeCapacity(route,jobs,input.stage);
    if(assigned+input.qty>limit) fail("Stage quantity exceeds completed previous-stage capacity");
    if(await ErpOperation.exists({ ...scope,machineCode: input.machineCode,status: { $ne: "CANCELLED" },start: { $lt: input.end },end: { $gt: input.start } }).session(session)) fail("Machine schedule overlaps an existing operation");
    return (await ErpOperation.create([{ ...scope,...input,key: requestKey,requestHash: hash,createdBy: actor(req) }],{session}))[0];
  }));
}));
router.post("/operations/:id/events",gate("post"),asyncHandler(async (req,res) => {
  const operationId=id(req.params.id), requestKey=key(req);
  const input={ operationId,action: req.body.action,reason: req.body.reason,notes: text(req.body.notes),revision: req.body.revision };
  const hash=requestHash(input);
  res.json(await transaction(async (scope,session) => {
    const duplicate=await ErpOperationEvent.findOne({ ...scope,key: requestKey }).session(session).lean();
    if(duplicate) { if(duplicate.requestHash!==hash) fail("Idempotency key has different event data"); return await ErpOperation.findOne({ ...scope,_id: operationId }).session(session).lean(); }
    const job=await ErpOperation.findOne({ ...scope,_id: operationId }).session(session);
    if(!job || job.revision!==input.revision) fail("Operation changed; refresh before submitting");
    await workOrder(scope,job.workOrderId,session);
    if(["START","RESUME"].includes(input.action) && await ErpOperation.exists({ ...scope,_id: { $ne: job._id },machineCode: job.machineCode,status: { $in: ["RUNNING","PAUSED"] } }).session(session)) fail("Machine already has an active operation");
    if(["START","RESUME"].includes(input.action) && await ErpMaintenance.exists({ ...scope,machineCode:job.machineCode,status:"OPEN",blocksOperation:true,dueAt:{$lte:new Date()} }).session(session)) fail("Machine has due blocking maintenance; complete it before starting/resuming");
    const now=new Date(), changes=transition(job,input,now); Object.assign(job,changes); job.revision++;
    if(changes.status==="COMPLETE") job.completedBy=actor(req);
    await job.save({ session });
    await ErpOperationEvent.create([{ ...scope,...input,key: requestKey,requestHash: hash,actor: actor(req),at: now }],{session});
    return job.toObject();
  }));
}));
router.get("/events",asyncHandler(async (req,res) => {
  res.json(await ErpOperationEvent.find({ ...workspaceFilter(),...(req.query.operationId ? { operationId: id(req.query.operationId) } : {}) }).sort({ at: -1 }).limit(2000).lean());
}));
router.get("/maintenance",asyncHandler(async(_req,res)=>res.json(await ErpMaintenance.find(workspaceFilter()).sort({dueAt:1}).limit(2000).lean())));
router.post("/maintenance",gate("masters"),asyncHandler(async(req,res)=>{
  const dueAt=new Date(req.body.dueAt),machineCode=code(req.body.machineCode),title=text(req.body.title,200);
  if(!title||!Number.isFinite(dueAt.getTime())) fail("Maintenance title and due date required");
  res.json(await transaction(async(scope,session)=>{
    if(!await ErpMachine.exists({...scope,code:machineCode}).session(session)) fail("Machine not found");
    return (await ErpMaintenance.create([{...scope,machineCode,title,dueAt,blocksOperation:req.body.blocksOperation===true,createdBy:actor(req)}],{session}))[0];
  }));
}));
router.post("/maintenance/:id/complete",gate("masters"),asyncHandler(async(req,res)=>{
  if(!text(req.body.notes)) fail("Maintenance completion notes required");
  res.json(await transaction(async(scope,session)=>{
    const ticket=await ErpMaintenance.findOne({...scope,_id:id(req.params.id)}).session(session);
    if(!ticket) fail("Maintenance ticket not found");if(ticket.status==="COMPLETE") return ticket;
    Object.assign(ticket,{status:"COMPLETE",notes:text(req.body.notes,2000),completedAt:new Date(),completedBy:actor(req)});await ticket.save({session});return ticket;
  }));
}));
router.get("/mrp",asyncHandler(async (_req,res) => {
  const scope=workspaceFilter();
  const [documents,balances,skus]=await Promise.all([ErpDocument.find(scope).limit(10001).lean(),ErpBalance.find(scope).limit(20001).lean(),ErpSku.find(scope).limit(2001).lean()]);
  if(documents.length>10000 || balances.length>20000 || skus.length>2000) fail("Planning data exceeds current report capacity");
  res.json({ rows: materialPlan(documents.filter(d => d.type==="WORK_ORDER"&&!d.reversedBy),documents,balances,skus),note: "Gross requirements less issued materials. No stock reservation or automatic purchase; reviewed suggestions only." });
}));
router.post("/rolls",gate("post"),asyncHandler(async (req,res) => {
  const input={ sku: code(req.body.sku),receiptId: id(req.body.receiptId),rollNo: code(req.body.rollNo),fabricCode: code(req.body.fabricCode),colour: code(req.body.colour),dcNo: code(req.body.dcNo),dia: text(req.body.dia,20),setNo: code(req.body.setNo) };
  if(!/^\d+(\.\d{1,2})?$/.test(input.dia) || Number(input.dia)<=0) fail("Positive Dia is required");
  res.json(await transaction(async (scope,session) => {
    const receipt=await ErpDocument.findOne({ ...scope,_id: input.receiptId,type: { $in: ["OPENING","GOODS_RECEIPT"] },reversedBy: { $exists: false } }).session(session).lean();
    const line=receipt?.lines.find(l => l.sku===input.sku);
    if(!line || line.unit!=="KG" || line.kind!=="RAW") fail("Register one distinct RAW KG SKU per physical roll from a valid receipt");
    if(await ErpDocument.countDocuments({ ...scope,type:{$in:["OPENING","GOODS_RECEIPT"]},"lines.sku":input.sku,reversedBy:{$exists:false} }).session(session)>1) fail("SKU has multiple receipts; reconcile and use a distinct physical-roll SKU");
    const other=await ErpRoll.findOne({ ...scope,$or: [{sku: input.sku},{rollNo: input.rollNo}] }).session(session).lean();
    if(other) { if(requestHash(Object.fromEntries(Object.keys(input).map(k=>[k,other[k]])))!==requestHash(input)) fail("Roll/SKU already registered with different details"); return other; }
    const setRows=await ErpRoll.find({ ...scope,dcNo: input.dcNo }).session(session).lean();
    if(setRows.some(r=>r.setNo!==input.setNo)) fail("One DC must use one Set No");
    if(await ErpRoll.exists({ ...scope,setNo: input.setNo,dcNo: {$ne:input.dcNo} }).session(session)) fail("Set No belongs to another DC");
    const d=new Date(receipt.date),y=d.getUTCFullYear()-(d.getUTCMonth()<3?1:0);
    const group=setRows.find(r=>r.fabricCode===input.fabricCode&&r.colour===input.colour&&r.dia===input.dia);
    const batchNo=group?.batchNo||`${String(y).slice(-2)}-${String(y+1).slice(-2)}/${input.fabricCode}/${input.colour}/${input.dcNo}/${input.dia}/${String(setRows.length+1).padStart(4,"0")}`;
    return (await ErpRoll.create([{ ...scope,...input,receiptQty: line.qty,batchNo,createdBy: actor(req) }],{session}))[0];
  }));
}));
router.get("/rolls/:id",asyncHandler(async (req,res) => {
  const scope=workspaceFilter(),roll=await ErpRoll.findOne({ ...scope,_id: id(req.params.id) }).lean();
  if(!roll) fail("Roll not found in this workspace");
  const balances=await ErpBalance.find({ ...scope,sku: roll.sku }).select("sku location qty").lean();
  const receipt=await ErpDocument.findOne({ ...scope,_id: roll.receiptId }).select("number reversedBy").lean();
  res.json({ roll,balances,receipt,trace: await ErpDocument.find({ ...scope,"lines.sku": roll.sku }).sort({ date:-1 }).limit(500).select("number type date sourceId reversedBy").lean() });
}));
export default router;
