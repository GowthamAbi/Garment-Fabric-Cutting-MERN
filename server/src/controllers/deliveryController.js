import DeliveryVendor from "../models/DeliveryVendor.js";
import crypto from "node:crypto";
import {currentDatabase} from "../config/tenantDatabase.js";
import {validateDeliveryLines,deliveryStageStatus,deliveryChallanSummary,validateHandover} from "../erp/deliveryPolicy.js";
import DeliveryChallan from "../models/DeliveryChallan.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";

const upper = (v) =>
  String(v || "")
    .trim()
    .toUpperCase();
const num = (v) => Number(v || 0);
async function nextCode(key, prefix, width = 4) {
  const row = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `${prefix}-${String(row.value).padStart(width, "0")}`;
}
async function deliveryMap(planNos, session=null) {
  const rows = await DeliveryChallan.find({
    planNo: { $in: planNos },
    status: "ISSUED",
  }).session(session).lean();
  const map = new Map();
  rows.forEach((doc) =>
    doc.lines.forEach((line) => {
      const key = `${doc.planNo}|${upper(line.colour)}|${upper(line.size)}`;
      map.set(key, (map.get(key) || 0) + num(line.pcs));
    }),
  );
  return map;
}
const stages=deliveryStageStatus;
export async function listVendors(req, res) {
  const search = String(req.query.search || "");
  const query = search
    ? {
        $or: [
          { vendorCode: new RegExp(search, "i") },
          { vendorName: new RegExp(search, "i") },
        ],
      }
    : {};
  res.json(await DeliveryVendor.find(query).sort({ vendorCode: 1 }).lean());
}
export async function getVendor(req, res) {
  const row = await DeliveryVendor.findOne({
    vendorCode: upper(req.params.code),
    active: true,
  }).lean();
  if (!row) throw new ApiError(404, "Vendor code not found");
  res.json(row);
}
export async function saveVendor(req, res) {
  if (!String(req.body.vendorName || "").trim())
    throw new ApiError(400, "Vendor name is required");
  const values = {
    vendorName: String(req.body.vendorName).trim(),
    address: String(req.body.address || "").trim(),
    qcName: String(req.body.qcName || "").trim(),
    active: req.body.active !== false,
    stitchingItems: [
      ...new Set(
        (req.body.stitchingItems || [])
          .map((x) => String(x).trim())
          .filter(Boolean),
      ),
    ],
  };
  let row;
  if (req.params.id)
    row = await DeliveryVendor.findByIdAndUpdate(req.params.id, values, {
      new: true,
      runValidators: true,
    });
  else
    row = await DeliveryVendor.create({
      ...values,
      vendorCode: await nextCode("DELIVERY_VENDOR", "VEN"),
      createdBy: req.user?.email,
    });
  if (!row) throw new ApiError(404, "Vendor not found");
  res.status(req.params.id ? 200 : 201).json(row);
}
export async function listPlanDetails(req, res) {
  const plans = await FabricCutPlan.find().sort({ createdAt: -1 }).lean();
  const actuals = await FabricCutActual.find({
    planNo: { $in: plans.map((p) => p.planNo) },
  }).lean();
  const actualMap = new Map(actuals.map((a) => [a.planNo, a]));
  const used = await deliveryMap(plans.map((p) => p.planNo));
  res.json(
    plans.map((plan) => {
      const actual = actualMap.get(plan.planNo);
      const deliveredPcs = [...used]
        .filter(([key]) => key.startsWith(`${plan.planNo}|`))
        .reduce((s, [, v]) => s + v, 0);
      return {
        ...plan,
        ...stages(plan, actual),
        actualPcs: num(actual?.totalActualPcs),
        deliveredPcs,
        cuttingBalancePcs: Math.max(
          0,
          num(actual?.totalActualPcs) - deliveredPcs,
        ),
      };
    }),
  );
}
export async function getPlanSetup(req, res) {
  const no = upper(req.params.no);
  const plan = await FabricCutPlan.findOne({
    $or: [{ planNo: no }, { dcNo: no }],
  }).lean();
  if (!plan) throw new ApiError(404, "Plan / DC not found");
  const actual = await FabricCutActual.findOne({ planNo: plan.planNo }).lean();
  const used = await deliveryMap([plan.planNo]);
  const lines = (actual?.lines || [])
    .map((line) => {
      const deliveredPcs =
        used.get(`${plan.planNo}|${upper(line.colour)}|${upper(line.size)}`) ||
        0;
      return {
        colour: upper(line.colour),
        size: upper(line.size),
        actualPcs: num(line.actualPcs),
        deliveredPcs,
        balancePcs: Math.max(0, num(line.actualPcs) - deliveredPcs),
      };
    })
    .filter((line) => line.balancePcs > 0);
  res.json({ plan, actual, ...stages(plan, actual), lines });
}
export async function createChallan(req, res) {
  const planNo=upper(req.body.planNo),vendorCode=upper(req.body.vendorCode);
  if(!/^[A-Z0-9_/-]{2,100}$/.test(planNo)||!/^[A-Z0-9_-]{2,75}$/.test(vendorCode))
    throw new ApiError(400,"Valid Plan No and Vendor Code required");
  const requestKey=String(req.get?.("Idempotency-Key")||"").trim()||crypto.randomUUID();
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(requestKey))
    throw new ApiError(400,"Idempotency-Key must be 16-100 characters");
  const expected=String(req.body.expectedHandoverAt||"").trim();
  const expectedHandoverAt=expected?new Date(expected):null;
  if(expected&&(!Number.isFinite(expectedHandoverAt.getTime())||expectedHandoverAt<new Date("2020-01-01")))
    throw new ApiError(400,"Invalid expected handover date");
  const remarks=String(req.body.remarks||"").trim();
  if(remarks.length>300)throw new ApiError(400,"Remarks max 300 characters");
  // Pre-create unique indexes before using a replica-set transaction.
  await Promise.all([DeliveryChallan.init(),FabricCutPlan.init()]);
  const session=await currentDatabase().startSession();
  let result, replay=false;
  try {
    await session.withTransaction(async()=>{
      // Atomic write conflict on the same Fabric Plan serializes simultaneous
      // challans. Never trust the previously displayed balance from the browser.
      const plan=await FabricCutPlan.findOneAndUpdate({planNo},
        {$inc:{deliveryRevision:1}},{new:true,session});
      if(!plan)throw new ApiError(404,"Cutting Plan not found");
      const actual=await FabricCutActual.findOne({planNo}).session(session).lean();
      if(!stages(plan,actual).eligible)
        throw new ApiError(409,"Cutting and Folding must be completed before delivery");
      const vendor=await DeliveryVendor.findOne({vendorCode,active:true}).session(session).lean();
      if(!vendor)throw new ApiError(409,"Active Vendor required");
      const used=await deliveryMap([planNo],session);
      const lines=validateDeliveryLines(req.body.lines,actual.lines,used,planNo);
      const hash=crypto.createHash("sha256").update(JSON.stringify({planNo,vendorCode,lines,
        expectedHandoverAt:expectedHandoverAt?.toISOString()||"",remarks})).digest("hex");
      const existing=await DeliveryChallan.findOne({requestKey}).session(session).lean();
      if(existing){
        if(existing.requestHash!==hash)
          throw new ApiError(409,"Idempotency key reused with different challan data");
        result=existing;replay=true;return;
      }
      const challanNo=await nextCode("DELIVERY_CHALLAN","DCH",5);
      const [saved]=await DeliveryChallan.create([{
        challanNo,deliveryDate:req.body.deliveryDate||new Date(),
        planNo:plan.planNo,dcNo:plan.dcNo,orderNo:plan.orderNo,itemCode:plan.itemCode,
        itemName:plan.itemName,style:plan.style,
        vendorCode:vendor.vendorCode,vendorName:vendor.vendorName,
        vendorAddress:vendor.address,qcName:vendor.qcName,
        lines,totalPcs:lines.reduce((n,x)=>n+x.pcs,0),remarks,requestKey,
        requestHash:hash,expectedHandoverAt,createdBy:req.user?.email||req.user?.userId
      }],{session});
      result=saved.toObject();
    });
  } finally { await session.endSession(); }
  res.status(replay?200:201).json(result);
}

export async function handoverChallan(req,res){
  const {reference,remarks}=validateHandover(req.body);
  if(!/^[0-9a-f]{24}$/i.test(req.params.id))throw new ApiError(400,"Invalid DC ID");
  const now=new Date();
  const result=await DeliveryChallan.findOneAndUpdate({
    _id:req.params.id,status:"ISSUED",handoverAt:{$exists:false}
  },{$set:{handoverAt:now,handoverReference:reference,
    handoverRemarks:remarks,handoverBy:req.user.userId||req.user.email}},{new:true,runValidators:true});
  if(result)return res.json(result);
  const prev=await DeliveryChallan.findById(req.params.id).lean();
  if(!prev)throw new ApiError(404,"Delivery Challan not found");
  if(prev.status!=="ISSUED")throw new ApiError(409,"Cancelled DC cannot be handed over");
  if(prev.handoverReference===reference)return res.json(prev);
  throw new ApiError(409,"Already handed over with a different reference");
}

export async function deliveryMonitoring(req,res){
  const [vendors,challans,plans,actuals]=await Promise.all([
    DeliveryVendor.find({active:true}).sort({vendorCode:1}).limit(1000).lean(),
    DeliveryChallan.find({}).sort({deliveryDate:-1}).limit(5000).lean(),
    FabricCutPlan.find({}).sort({createdAt:-1}).limit(1000).lean(),
    FabricCutActual.find({status:"COMPLETED"}).limit(1500).lean(),
  ]);
  const {summary,vendors:vendorRows}=deliveryChallanSummary(challans,vendors);
  const actualMap=new Map(actuals.map(x=>[x.planNo,x]));
  const issued=new Map();
  for(const dc of challans){
    if(dc.status==="CANCELLED")continue;
    issued.set(dc.planNo,(issued.get(dc.planNo)||0)+Number(dc.totalPcs||0));
  }
  const planRows=plans.map(plan=>{
    const actual=actualMap.get(plan.planNo);
    const qty=Number(actual?.totalActualPcs||0),allocated=issued.get(plan.planNo)||0;
    return {planNo:plan.planNo,dcNo:plan.dcNo,itemName:plan.itemName,
      ...stages(plan,actual),actualPcs:qty,issuedPcs:allocated,
      unallocatedPcs:Math.max(0,qty-allocated)};
  });
  res.json({summary:{...summary,plans:planRows.length,
    unallocatedPcs:planRows.reduce((n,p)=>n+p.unallocatedPcs,0)},
    vendors:vendorRows,plans:planRows,
    overdue:challans.filter(c=>c.status==="ISSUED"&&!c.handoverAt&&c.expectedHandoverAt&&
      new Date(c.expectedHandoverAt)<new Date()).map(c=>({
        id:String(c._id),challanNo:c.challanNo,vendorCode:c.vendorCode,
        planNo:c.planNo,totalPcs:c.totalPcs,expectedHandoverAt:c.expectedHandoverAt,
      })),
    awaitingHandover:challans.filter(c=>c.status==="ISSUED"&&!c.handoverAt).slice(0,500)
      .map(c=>({id:String(c._id),challanNo:c.challanNo,planNo:c.planNo,
        vendorCode:c.vendorCode,vendorName:c.vendorName,totalPcs:c.totalPcs,
        deliveryDate:c.deliveryDate,expectedHandoverAt:c.expectedHandoverAt})),
  });
}
export async function listHistory(req, res) {
  const q = {};
  if (req.query.from || req.query.to)
    q.deliveryDate = {
      ...(req.query.from && { $gte: new Date(req.query.from) }),
      ...(req.query.to && { $lte: new Date(`${req.query.to}T23:59:59.999Z`) }),
    };
  if (req.query.vendorCode) q.vendorCode = upper(req.query.vendorCode);
  if (req.query.planNo) q.planNo = upper(req.query.planNo);
  res.json(
    await DeliveryChallan.find(q)
      .sort({ deliveryDate: -1, createdAt: -1 })
      .lean(),
  );
}
export async function cuttingStock(req, res) {
  const actuals = await FabricCutActual.find({ status: "COMPLETED" })
    .sort({ createdAt: -1 })
    .lean();
  const used = await deliveryMap(actuals.map((x) => x.planNo));
  const rows = [];
  actuals.forEach((actual) =>
    actual.lines.forEach((line) => {
      const deliveredPcs =
        used.get(
          `${actual.planNo}|${upper(line.colour)}|${upper(line.size)}`,
        ) || 0;
      const balancePcs = Math.max(0, num(line.actualPcs) - deliveredPcs);
      if (balancePcs > 0)
        rows.push({
          _id: `${actual._id}-${line._id}`,
          createdAt: actual.createdAt,
          planNo: actual.planNo,
          dcNo: actual.dcNo,
          itemName: actual.itemName,
          colour: line.colour,
          size: line.size,
          actualPcs: line.actualPcs,
          deliveredPcs,
          balancePcs,
          status: "AVAILABLE",
        });
    }),
  );
  res.json(rows);
}
