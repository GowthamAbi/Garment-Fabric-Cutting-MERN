import {validateRouting,routedNext,routeAdvance,routeActor,bomUsable} from "./routingPolicy.js";
import {hasPermission} from "../utils/accessPolicy.js";
import {ErpBom} from "./models.js";
import {ErpRoll} from './operationsModels.js';
import {boundaryOptions,assertBoundary,assertOutwardBoundary,inwardStage,outwardAllowed} from './boundaryPolicy.js';
import {scaled} from './policy.js';
import {locationAllowed,strictAccess} from '../utils/accessPolicy.js';
import { currentDatabase } from "../config/tenantDatabase.js";
import {Router} from 'express';
import mongoose from 'mongoose';
import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Company from '../models/Company.js';
import {workspaceFilter,requestHash} from './service.js';
import {ErpSettings,ErpParty,ErpSku,ErpBalance,ErpDocument,ErpEntry,ErpSequence} from './models.js';
import {DepartmentMaster as Master,DepartmentLot as Lot,DepartmentBundle as Bundle,DepartmentEvent as Event,RetailSale as Sale,DepartmentDemand as Demand,DepartmentTarget as Target,DepartmentException as Exception,DepartmentCost as Cost,DEPARTMENT_MODELS} from './departmentModels.js';
import {DEPARTMENTS,WORKFLOW_DEPARTMENTS,allowedShop,allowedDepartment,enabledDepartment,pieces,names,checkSplit,stageAfter,packingRequirements,saleTotals,demandSuggestion} from './departmentPolicy.js';
import {fail,money,ratio,safeInteger} from './policy.js';
import { forecastDemand, dailyNetSales, scenarioForecast } from './forecastPolicy.js';
import { departmentSummary } from './departmentReports.js';
import accessoriesRoutes from "./accessoriesRoutes.js";
import elasticRoutes from "./elasticRoutes.js";
import DeliveryChallan from '../models/DeliveryChallan.js';
import FabricCutPlan from '../models/FabricCutPlan.js';
import FabricCutActual from '../models/FabricCutActual.js';
import { legacyHandoff } from './legacyHandoffPolicy.js';
import { managementReport } from './managementReports.js';
import { countDifference, approveException } from './warehousePolicy.js';
import { allocateLotCost } from './lotCostPolicy.js';
const router=Router();
const clean=v=>String(v||'').trim().slice(0,120);
const deptFor=stage=>stage==='INWARD_READY'?'INWARD':stage.startsWith('OP:')||['STITCHING_READY','STITCHED','REWORK','REWORK_DONE'].includes(stage)?'STITCHING':['OIL','OIL_DONE','CHECKING','GOOD','WASTE'].includes(stage)?'CHECKING':['IRONING','IRONED'].includes(stage)?'IRONING':stage==='PACKED'?'DISPATCH':stage==='TRANSIT_WAREHOUSE'?'DISPATCH':stage.startsWith('WAREHOUSE:')||stage.startsWith('TRANSIT_SHOP:')?'WAREHOUSE':'SHOP';
function location(b){return `DPT:${b.stage}:${b.code}`;}
function shopAccess(req,code){if(!allowedShop(req.user,code))throw new ApiError(403,'Assigned shop permission required');}
function requireAccess(req,department,write=true){if(!DEPARTMENTS.includes(department)||!allowedDepartment(req.user,department,write)||!enabledDepartment(req.departmentCompany,department))throw new ApiError(403,`${department} department permission/subscription required`);if(write)req.departmentWrite=department;}
router.use(asyncHandler(async(req,_res,next)=>{req.departmentCompany=await Company.findById(workspaceFilter().companyId).lean();if(!req.departmentCompany)fail('Company not found');next();}));
async function transaction(req,kind,fn){
 const scope=workspaceFilter(),key=clean(req.body.key);if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))fail('A 16–100 character idempotency key is required');
 const hash=requestHash({kind,...req.body});await Promise.all([...DEPARTMENT_MODELS,ErpBalance,ErpEntry,ErpDocument,ErpSequence].map(m=>m.init()));
 const session=await currentDatabase().startSession();let result;
 try{await session.withTransaction(async()=>{
  const lock=await ErpSettings.findOneAndUpdate({...scope,key:'ERP',enabled:true},{$inc:{revision:1}},{new:true,session});if(!lock)fail('ERP activation required');
  const old=await Event.findOne({...scope,key}).session(session);if(old){requireAccess(req,old.department);if(old.actor!==req.user.userId&&!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Retry belongs to another user');if(old.requestHash!==hash)fail('Retry key has different contents');result=old;return;}
  const details=await fn(scope,session);[result]=await Event.create([{...scope,key,requestHash:hash,kind,department:req.departmentWrite,actor:req.user.userId,...details}],{session});
 });return result;}finally{await session.endSession();}
}
async function sequence(scope,session,prefix){const s=await ErpSequence.findOneAndUpdate({...scope,key:`DPT:${prefix}`},{$inc:{value:1}},{upsert:true,new:true,session});return `${prefix}-${new Date().getUTCFullYear()}-${String(s.value).padStart(7,'0')}`;}
function bundleAccess(req,b){if(b.stage.startsWith("WAREHOUSE:")||b.stage==="TRANSIT_WAREHOUSE"){if(!locationAllowed(req.user,"WAREHOUSE",b.destination))throw new ApiError(403,"Assigned warehouse required");}if(b.stage.startsWith("SHOP:")||b.stage.startsWith("TRANSIT_SHOP:"))shopAccess(req,b.destination);}
async function getBundle(id,scope,session,req){if(!mongoose.isValidObjectId(id))fail('Invalid bundle');const b=await Bundle.findOne({...scope,_id:id}).session(session);if(!b||b.qty<=0)fail('Bundle is empty or unavailable');bundleAccess(req,b);return b;}
async function newBundle(scope,session,lot,qty,stage,parent='',destination='',cycle=0){const [b]=await Bundle.create([{...scope,code:await sequence(scope,session,'BND'),lotId:String(lot._id),parentId:parent,qty,stage,destination,cycle}],{session});return b;}
async function journalMove(scope,session,req,moves,journals=[],totals={net:0,tax:0,gross:0},type='DEPARTMENT_MOVEMENT'){
 const id=new mongoose.Types.ObjectId(),number=await sequence(scope,session,'DEP'),date=new Date(),posted=[];
 for(const m of moves){const key=`${m.sku}@${m.location}`;let b=await ErpBalance.findOne({...scope,key}).session(session);if(!b){[b]=await ErpBalance.create([{...scope,key,sku:m.sku,location:m.location,qty:0,value:0}],{session});}
  const nextQty=b.qty+m.delta,nextValue=b.value+m.value;if(nextQty<0||nextValue<0)fail('Stock quantity/value cannot be negative');safeInteger(nextQty);safeInteger(nextValue);b.qty=nextQty;b.value=nextValue;await b.save({session});posted.push({...m,qtyAfter:b.qty,valueAfter:b.value});
  await ErpEntry.create([{...scope,documentId:id,documentNo:number,date,kind:'STOCK',key,sku:m.sku,location:m.location,delta:m.delta,value:m.value,qtyAfter:b.qty,valueAfter:b.value}],{session});
 }
 if(journals.reduce((n,j)=>n+j.debit-j.credit,0)!==0)fail('Unbalanced journal');
 for(const j of journals)await ErpEntry.create([{...scope,documentId:id,documentNo:number,date,kind:'JOURNAL',...j}],{session});
 await ErpDocument.create([{...scope,_id:id,number,type,date,idempotencyKey:`department_${req.body.key}_${number}`,requestHash:requestHash(req.body),lines:[],moves:posted,journals,totals,metadata:{departmentManaged:true,departmentEventKey:req.body.key},postedBy:req.user.userId,notes:clean(req.body.notes)}],{session});return String(id);
}
async function take(scope,session,sku,from,count){const qty=count*1000,b=await ErpBalance.findOne({...scope,key:`${sku}@${from}`}).session(session);if(!b||b.qty<qty)fail('Insufficient source stock');const value=qty===b.qty?b.value:ratio(b.value,qty,b.qty);return {sku,location:from,delta:-qty,value:-value};}
async function moveBundle(req,scope,session,b,count,next,destination=''){
 if(count>b.qty)fail('Quantity exceeds bundle');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session);if(!lot)fail('Lot not found');
 const out=await take(scope,session,lot.sku,location(b),count),child=await newBundle(scope,session,lot,count,next,String(b._id),destination,b.cycle+(next==='CHECKING'?1:0));
 if(next===b.stage&&destination===b.destination){child.bin=b.bin;await child.save({session});}
 b.qty-=count;await b.save({session});const documentId=await journalMove(scope,session,req,[out,{sku:lot.sku,location:location(child),delta:count*1000,value:-out.value}]);return {child,documentId,lot};
}
function routeAdministrator(req){if(!['company_owner','company_admin','admin'].includes(req.user.role)||strictAccess(req.user)&&!hasPermission(req.user,'erp.masters'))throw new ApiError(403,'Company master administrator required');}
async function approvedRoute(req,scope,session,sku){
 if(!req.body.routeKey)return {};const route=await Master.findOne({...scope,key:req.body.routeKey,kind:'ROUTE',approvalStatus:'APPROVED',sku}).session(session).lean();if(!route)fail('Approved matching SKU route required');validateRouting(route.stages,req.departmentCompany);
 const bom=route.bomCode?await ErpBom.findOne({...scope,code:route.bomCode,outputSku:sku,approvalStatus:'APPROVED',active:{$ne:false}}).session(session).lean():null;if(route.bomCode&&!bom)fail('Approved BOM version unavailable');
 return {routeSnapshot:{key:route.key,stages:route.stages,externalInput:route.externalInput===true,construction:route.construction,approvedBy:route.approvedBy},bomSnapshot:bom?{code:bom.code,outputQty:bom.outputQty,components:bom.components,approvedBy:bom.approvedBy}:undefined};
}
// ACCESSORIES shares the transactional ERP stock ledger.
router.use("/accessories", accessoriesRoutes);
router.use("/elastic", elasticRoutes);
router.get('/routing-masters',asyncHandler(async(req,res)=>{routeAdministrator(req);const scope=workspaceFilter();res.json({routes:await Master.find({...scope,kind:'ROUTE'}).sort({_id:-1}).limit(500).lean(),boms:await ErpBom.find(scope).sort({_id:-1}).limit(500).lean()});}));
router.post('/routing-masters',asyncHandler(async(req,res)=>{routeAdministrator(req);const stages=validateRouting(req.body.stages,req.departmentCompany);requireAccess(req,stages[0]);res.json(await transaction(req,'ROUTE_DRAFT',async(scope,session)=>{
 const key=clean(req.body.masterKey),sku=clean(req.body.sku).toUpperCase();if(!/^[A-Za-z0-9_-]{2,60}$/.test(key)||await Master.exists({...scope,key}).session(session))fail('New unique version key required');if(!await ErpSku.exists({...scope,code:sku,kind:'FINISHED'}).session(session))fail('Finished SKU required');
 const [master]=await Master.create([{...scope,key,kind:'ROUTE',sku,stages,externalInput:req.body.externalInput===true,bomCode:clean(req.body.bomCode).toUpperCase(),construction:{elastic:req.body.elastic===true,strap:req.body.strap===true},approvalStatus:'DRAFT',createdBy:req.user.userId}],{session});return {details:{master}};
}));}));
router.post('/routing-masters/:id/approve',asyncHandler(async(req,res)=>{routeAdministrator(req);if(req.body.confirm!=='APPROVE ROUTE')fail('Type APPROVE ROUTE after reviewing QC bypass and construction');res.json(await transaction(req,'ROUTE_APPROVAL',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.params.id))fail('Invalid route');const m=await Master.findOne({...scope,_id:req.params.id,kind:'ROUTE',approvalStatus:'DRAFT'}).session(session);if(!m||m.createdBy===req.user.userId)fail('Another administrator must approve the draft');validateRouting(m.stages,req.departmentCompany);requireAccess(req,m.stages[0]);if(m.bomCode&&!await ErpBom.exists({...scope,code:m.bomCode,outputSku:m.sku,approvalStatus:'APPROVED',active:{$ne:false}}).session(session))fail('Approve the matching BOM first');m.approvalStatus='APPROVED';m.approvedBy=req.user.userId;m.approvedAt=new Date();await m.save({session});return {details:{master:m}};
}));}));
router.post('/boms/:id/approve',asyncHandler(async(req,res)=>{routeAdministrator(req);if(req.body.confirm!=='APPROVE BOM')fail('Type APPROVE BOM');const scope=workspaceFilter();if(!mongoose.isValidObjectId(req.params.id))fail('Invalid BOM');const bom=await ErpBom.findOneAndUpdate({...scope,_id:req.params.id,approvalVersion:1,approvalStatus:'DRAFT',createdBy:{$ne:req.user.userId}},{$set:{approvalStatus:'APPROVED',approvedBy:req.user.userId,approvedAt:new Date()}},{new:true});if(!bom)fail('Another administrator must approve a new draft BOM');res.json(bom);}));
router.get('/boundaries/:department',asyncHandler(async(req,res)=>{requireAccess(req,req.params.department,false);res.json(boundaryOptions(req.departmentCompany,req.params.department));}));
router.post('/external-materials',asyncHandler(async(req,res)=>{requireAccess(req,'PACKING');if(enabledDepartment(req.departmentCompany,'ACCESSORIES'))fail('Use subscribed Accessories stock receipt');res.json(await transaction(req,'EXTERNAL_MATERIALS',async(scope,session)=>{
 const sku=clean(req.body.sku).toUpperCase(),reference=clean(req.body.reference).toUpperCase();if(!reference||!clean(req.body.counterparty))fail('Reference and counterparty required');
 if(!await ErpSku.exists({...scope,code:sku,kind:{$in:['RAW','CONSUMABLE']}}).session(session))fail('Material SKU master required');
 if(await Event.exists({...scope,kind:'EXTERNAL_MATERIALS','details.reference':reference,'details.sku':sku}).session(session))fail('Material receipt already recorded');
 const qty=scaled(req.body.quantity,1000,'Quantity',true),value=money(req.body.totalValue);
 const documentId=await journalMove(scope,session,req,[{sku,location:'ACCESSORIES',delta:qty,value}],value?[{account:'INVENTORY',debit:value,credit:0},{account:'EXTERNAL_CLEARING',debit:0,credit:value}]:[],{net:value,tax:0,gross:value},'EXTERNAL_PACKING_MATERIAL_RECEIPT');return {quantity:qty/1000,documentId,details:{reference,sku,counterparty:clean(req.body.counterparty)}};
}));}));
router.post('/external-market-observation',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING');assertBoundary(req.departmentCompany,'MARKETING','IN');res.json(await transaction(req,'EXTERNAL_MARKET_OBSERVATION',async(scope,session)=>{
 const sku=clean(req.body.sku).toUpperCase(),reference=clean(req.body.reference).toUpperCase();if(!reference||!await ErpSku.exists({...scope,code:sku}).session(session))fail('Reference and SKU required');
 if(await Event.exists({...scope,kind:'EXTERNAL_MARKET_OBSERVATION','details.reference':reference,'details.sku':sku}).session(session))fail('Observation already recorded');
 const sold=Number(req.body.sold),days=Number(req.body.days),leadDays=Number(req.body.leadDays),safety=Number(req.body.safety),stock=Number(req.body.stock),inTransit=Number(req.body.inTransit),suggested=demandSuggestion(sold,days,leadDays,safety,stock,inTransit);
 if(![sold,safety,stock,inTransit,days,leadDays].every(Number.isSafeInteger)||days>3660||leadDays>3660)fail('Use whole pieces and whole days within 3660');
 return {details:{reference,sku,sold,days,leadDays,safety,stock,inTransit,suggested,source:'EXTERNAL_OBSERVATION',notes:clean(req.body.notes)}};
}));}));
router.post('/integrated-core-transfer',asyncHandler(async(req,res)=>{
 const source=clean(req.body.department).toUpperCase(),destination=clean(req.body.destination).toUpperCase();requireAccess(req,source);
 const targets={FABRIC:['CUTTING'],CUTTING:['DELIVERY'],ELASTIC:['DELIVERY'],ACCESSORIES:['DELIVERY']};
 if(!targets[source]?.includes(destination)||!enabledDepartment(req.departmentCompany,destination))fail('Select a subscribed integrated destination');
 res.json(await transaction(req,'INTEGRATED_CORE_TRANSFER',async(scope,session)=>{
  const sku=clean(req.body.sku).toUpperCase(),reference=clean(req.body.reference).toUpperCase();if(!reference)fail('Internal handoff reference required');
  const variant=await ErpSku.findOne({...scope,code:sku}).session(session);if(!variant)fail('SKU master required');if(await ErpRoll.exists({...scope,sku}).session(session))fail('Use registered physical roll workflow');
  if(await Event.exists({...scope,kind:'INTEGRATED_CORE_TRANSFER',department:source,'details.reference':reference,'details.sku':sku}).session(session))fail('Internal handoff already recorded');
  if(['PCS','PC','PIECE','PIECES'].includes(variant.unit))pieces(req.body.quantity);const count=scaled(req.body.quantity,1000,'Quantity',true)/1000,out=await take(scope,session,sku,source,count);
  const documentId=await journalMove(scope,session,req,[out,{sku,location:destination,delta:-out.delta,value:-out.value}]);return {quantity:count,documentId,details:{reference,sku,source,destination}};
 }));
}));
router.post('/external-inward',asyncHandler(async(req,res)=>{
 const department=clean(req.body.department).toUpperCase();requireAccess(req,department);
 res.json(await transaction(req,'EXTERNAL_INWARD',async(scope,session)=>{
  const reference=clean(req.body.reference).toUpperCase(),sku=clean(req.body.sku).toUpperCase();if(!reference||!clean(req.body.counterparty))fail('External DC/reference and counterparty required');
  if(await Event.exists({...scope,kind:'EXTERNAL_INWARD',department,'details.reference':reference,'details.sku':sku}).session(session))fail('External receipt reference/SKU already recorded; use its original retry key');
  const variant=await ErpSku.findOne({...scope,code:sku,active:{$ne:false}}).session(session);if(!variant)fail('SKU master required');
  const entryRoute=await approvedRoute(req,scope,session,sku);if(!entryRoute.routeSnapshot?.externalInput)assertBoundary(req.departmentCompany,department,'IN');if(entryRoute.routeSnapshot&&entryRoute.routeSnapshot.stages[0]!==department)fail('External receipt must start at approved route first department');
  const value=money(req.body.totalValue),core=DEPARTMENTS.slice(0,5).includes(department);
  let qty,stockLocation,b,lot;
  if(core){if(await ErpRoll.exists({...scope,sku}).session(session))fail('Use registered physical roll workflow, not generic external receipt');if(['PCS','PC','PIECE','PIECES'].includes(variant.unit))pieces(req.body.quantity);qty=scaled(req.body.quantity,1000,'Quantity',true);stockLocation=department;}
  else{
   qty=pieces(req.body.quantity)*1000;if(variant.kind!=='FINISHED'||!['PCS','PC','PIECE','PIECES'].includes(variant.unit))fail('Finished piece SKU required');
   let operations=[],packing=[];
   if(department==='STITCHING'){const master=await Master.findOne({...scope,key:req.body.operationMaster,kind:'STITCHING',sku}).session(session);if(!master)fail('Stitching operation master required');operations=master.operations;}
   if(enabledDepartment(req.departmentCompany,'PACKING')){const master=await Master.findOne({...scope,key:req.body.packingMaster,kind:'PACKING',sku}).session(session);if(department==='PACKING'&&!master)fail('Packing master required');packing=master?.materials||[];}
   const destination=clean(req.body.destination);if(['WAREHOUSE','SHOP'].includes(department)){if(!await Master.exists({...scope,key:destination,kind:department}).session(session))fail('Location master required');if(!locationAllowed(req.user,department,destination))throw new ApiError(403,'Location not assigned');}
   const route=entryRoute;
   [lot]=await Lot.create([{...scope,...route,code:await sequence(scope,session,'LOT'),sku,sent:qty/1000,received:department==='STITCHING'||department==='INWARD'?0:qty/1000,orderNo:clean(req.body.orderNo),dcNo:reference,section:clean(req.body.counterparty),sourceLocation:'EXTERNAL',originDepartment:department,externalReference:reference,operations,packing,createdBy:req.user.userId}],{session});
   b=await newBundle(scope,session,lot,qty/1000,inwardStage(department,destination),'',destination);stockLocation=location(b);
  }
  const documentId=await journalMove(scope,session,req,[{sku,location:stockLocation,delta:qty,value}],value?[{account:'INVENTORY',debit:value,credit:0},{account:'EXTERNAL_CLEARING',debit:0,credit:value}]:[],{net:value,tax:0,gross:value},'EXTERNAL_STOCK_RECEIPT');
  return {lotId:lot?String(lot._id):undefined,bundleId:b?String(b._id):undefined,quantity:qty/1000,documentId,details:{reference,sku,counterparty:clean(req.body.counterparty),unit:variant.unit,bundle:b}};
 }));
}));
router.post('/external-outward',asyncHandler(async(req,res)=>{
 const department=clean(req.body.department).toUpperCase();requireAccess(req,department);
 res.json(await transaction(req,'EXTERNAL_OUTWARD',async(scope,session)=>{
  if(!clean(req.body.reference)||!clean(req.body.counterparty))fail('External DC/reference and counterparty required');
  const core=DEPARTMENTS.slice(0,5).includes(department);let b,sku,count,from;
  if(core){assertBoundary(req.departmentCompany,department,'OUT');sku=clean(req.body.sku).toUpperCase();const variant=await ErpSku.findOne({...scope,code:sku}).session(session);if(!variant)fail('SKU master required');if(await ErpRoll.exists({...scope,sku}).session(session))fail('Use registered physical roll workflow, not generic external outward');if(['PCS','PC','PIECE','PIECES'].includes(variant.unit))pieces(req.body.quantity);count=scaled(req.body.quantity,1000,'Quantity',true)/1000;from=department;}
  else{b=await getBundle(req.body.bundleId,scope,session,req);assertOutwardBoundary(req.departmentCompany,department,b.stage);if(!outwardAllowed(department,b.stage))fail('Complete this department before external outward');count=pieces(req.body.quantity);if(count>b.qty)fail('Quantity exceeds bundle');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session);if(lot.routeSnapshot&&b.stage!=='REWORK'&&lot.routeSnapshot.stages.includes(department)&&lot.routeSnapshot.stages.indexOf(department)<lot.routeSnapshot.stages.length-1)fail('Use approved route handoff rather than external outward');sku=lot.sku;from=location(b);b.qty-=count;await b.save({session});}
  if(await Event.exists({...scope,kind:'EXTERNAL_OUTWARD',department,'details.reference':clean(req.body.reference).toUpperCase(),'details.sku':sku}).session(session))fail('External handover reference/SKU already recorded');
  const out=await take(scope,session,sku,from,count),value=-out.value;
  const documentId=await journalMove(scope,session,req,[out],value?[{account:'EXTERNAL_CLEARING',debit:value,credit:0},{account:'INVENTORY',debit:0,credit:value}]:[],{net:value,tax:0,gross:value},'EXTERNAL_STOCK_HANDOVER');
  return {bundleId:b?String(b._id):undefined,quantity:count,documentId,details:{reference:clean(req.body.reference).toUpperCase(),counterparty:clean(req.body.counterparty),sku,value}};
 }));
}));
router.get('/catalog' ,asyncHandler(async(req,res)=>res.json({erpActive:Boolean(await ErpSettings.exists({...workspaceFilter(),key:'ERP',enabled:true})),departments:DEPARTMENTS.filter(d=>allowedDepartment(req.user,d,false)&&enabledDepartment(req.departmentCompany,d)),writeDepartments:DEPARTMENTS.filter(d=>allowedDepartment(req.user,d,true)&&enabledDepartment(req.departmentCompany,d))})));
router.post('/labour-cost',asyncHandler(async(req,res)=>{
 requireAccess(req,'STITCHING');if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator cost approval required');
 res.json(await transaction(req,'LABOUR_COST',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.body.lotId))fail('Valid lot ID required');const lot=await Lot.findOne({...scope,_id:req.body.lotId,status:'ACTIVE'}).session(session);if(!lot)fail('Active lot required');
 const bundles=await Bundle.find({...scope,lotId:String(lot._id),qty:{$gt:0}}).sort({_id:1}).limit(2001).session(session);if(bundles.length>2000)fail('Lot exceeds allocation capacity');
 const amount=money(req.body.amount),costReference=clean(req.body.costReference).toUpperCase(),paymentAccount=clean(req.body.paymentAccount),supplierCode=clean(req.body.supplierCode).toUpperCase();
 if(!costReference||!['AP','CASH','BANK'].includes(paymentAccount)||!clean(req.body.notes))fail('Unique bill/line reference, payment account and review notes required');
 if(paymentAccount==='AP'&&!await ErpParty.exists({...scope,code:supplierCode,kind:{$in:['SUPPLIER','BOTH']},active:{$ne:false}}).session(session))fail('Supplier ledger code required for jobwork payable');
 const allocations=allocateLotCost(amount,bundles.map(b=>b.qty),lot.sent),moves=[];
 for(let i=0;i<bundles.length;i++){const b=bundles[i],balance=await ErpBalance.findOne({...scope,key:`${lot.sku}@${location(b)}`}).session(session);if(!balance||balance.qty!==b.qty*1000)fail('Reconcile bundle stock before allocating costs');moves.push({sku:lot.sku,location:location(b),delta:0,value:allocations[i]});}
 const documentId=await journalMove(scope,session,req,moves,[{account:'INVENTORY',debit:amount,credit:0},{account:paymentAccount,debit:0,credit:amount,party:paymentAccount==='AP'?supplierCode:''}]);
 const [cost]=await Cost.create([{...scope,costReference,lotId:String(lot._id),amount,paymentAccount,supplierCode,documentId,createdBy:req.user.userId}],{session});return {lotId:String(lot._id),documentId,details:{cost,allocations}};
 }));
}));
router.get('/warehouse-bins',asyncHandler(async(req,res)=>{requireAccess(req,'WAREHOUSE',false);res.json((await Master.find({...workspaceFilter(),kind:'BIN'}).limit(2000).lean()).filter(m=>locationAllowed(req.user,'WAREHOUSE',m.warehouse)));}));
router.post('/warehouse-bins',asyncHandler(async(req,res)=>{
 requireAccess(req,'WAREHOUSE');res.json(await transaction(req,'BIN_MASTER',async(scope,session)=>{
 const key=clean(req.body.binKey),warehouse=clean(req.body.warehouse);if(!locationAllowed(req.user,'WAREHOUSE',warehouse))throw new ApiError(403,'Assigned warehouse required');if(!/^[A-Za-z0-9_-]{2,60}$/.test(key)||!clean(req.body.rack)||!clean(req.body.bin))fail('Bin key, rack and bin labels required');
 if(!await Master.exists({...scope,kind:'WAREHOUSE',key:warehouse}).session(session))fail('Warehouse master required');
 const [master]=await Master.create([{...scope,key,kind:'BIN',warehouse,rack:clean(req.body.rack),bin:clean(req.body.bin),name:clean(req.body.name)||key}],{session});return {details:{master}};
 }));
}));
router.post('/relocate',asyncHandler(async(req,res)=>{
 requireAccess(req,'WAREHOUSE');res.json(await transaction(req,'RELOCATE',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);if(!b.stage.startsWith('WAREHOUSE:'))fail('Received warehouse stock required');
 const target=await Master.findOne({...scope,kind:'BIN',key:clean(req.body.binKey),warehouse:b.destination,active:{$ne:false}}).session(session);if(!target)fail('Active bin in the same warehouse required');
 const moved=await moveBundle(req,scope,session,b,pieces(req.body.quantity),b.stage,b.destination);moved.child.bin=target.key;await moved.child.save({session});return {bundleId:String(b._id),quantity:pieces(req.body.quantity),documentId:moved.documentId,details:{bundle:moved.child}};
 }));
}));
function exceptionAccess(req,b){const d=b.stage==='TRANSIT_WAREHOUSE'?'WAREHOUSE':b.stage.startsWith('TRANSIT_SHOP:')?'SHOP':deptFor(b.stage);if(!['WAREHOUSE','SHOP'].includes(d))fail('Count/transit exception requires warehouse or shop stock');requireAccess(req,d);bundleAccess(req,b);if(d==='SHOP')shopAccess(req,b.destination);}
router.get('/stock-exceptions',asyncHandler(async(req,res)=>{if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');res.json((await Exception.find(workspaceFilter()).sort({_id:-1}).limit(2000).lean()).filter(row=>{if(!strictAccess(req.user))return true;const d=row.stage.startsWith('SHOP:')||row.stage.startsWith('TRANSIT_SHOP:')?'SHOP':'WAREHOUSE';return allowedDepartment(req.user,d,false)&&locationAllowed(req.user,d,row.destination);}));}));
router.post('/stock-exceptions',asyncHandler(async(req,res)=>{
 res.json(await transaction(req,'STOCK_EXCEPTION',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);exceptionAccess(req,b);if(req.body.countedQty==null||req.body.countedQty===''||typeof req.body.countedQty==='boolean')fail('Physical count required');const countedQty=Number(req.body.countedQty);countDifference(b.qty,countedQty);
 if(!['MISSING','DAMAGED'].includes(req.body.kind)||!clean(req.body.reason))fail('Exception kind and count reason required');
 const [request]=await Exception.create([{...scope,key:req.body.key,bundleId:String(b._id),kind:req.body.kind,expectedQty:b.qty,countedQty,stage:b.stage,destination:b.destination,reason:clean(req.body.reason),requestedBy:req.user.userId}],{session});return {bundleId:String(b._id),details:{request}};
 }));
}));
router.post('/stock-exceptions/:id/decision',asyncHandler(async(req,res)=>{
 if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');
 res.json(await transaction(req,'STOCK_EXCEPTION_DECISION',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!['APPROVED','REJECTED'].includes(req.body.status)||!clean(req.body.reason))fail('Decision and review reason required');
 const request=await Exception.findOne({...scope,_id:req.params.id,status:'PENDING'}).session(session);if(!request)fail('Pending exception required');
 const b=await Bundle.findOne({...scope,_id:request.bundleId}).session(session);if(!b)fail('Original bundle not found');exceptionAccess(req,{stage:request.stage,destination:request.destination});if(request.requestedBy===req.user.userId)fail('Independent administrator review required');let documentId;
 if(req.body.status==='APPROVED'){
 const count=approveException(request,b,req.user.userId);
 if(request.kind==='DAMAGED'){const moved=await moveBundle(req,scope,session,b,count,'WASTE');documentId=moved.documentId;}
 else{const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),out=await take(scope,session,lot.sku,location(b),count);b.qty-=count;await b.save({session});documentId=await journalMove(scope,session,req,[out],[{account:'WASTE_EXPENSE',debit:-out.value,credit:0},{account:'INVENTORY',debit:0,credit:-out.value}]);}
 }
 request.status=req.body.status;request.decidedBy=req.user.userId;request.decisionReason=clean(req.body.reason);request.documentId=documentId;await request.save({session});return {bundleId:String(b._id),documentId,details:{request}};
 }));
}));
router.get('/management',asyncHandler(async(req,res)=>{
 if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Management permission required');
 const scope=workspaceFilter(),days=Number(req.query.days||7);if(!Number.isInteger(days)||days<1||days>90)fail('Management window must be 1–90 days');
 const start=new Date(Date.now()-days*86400000),[lots,bundles,events,skus,targets]=await Promise.all([Lot.find(scope).limit(20001).lean(),Bundle.find(scope).limit(20001).lean(),Event.find({...scope,createdAt:{$gte:start},reversedBy:{$exists:false}}).limit(20001).lean(),ErpSku.find(scope).limit(20001).lean(),Target.find({...scope,date:{$gte:start.toISOString().slice(0,10),$lte:new Date().toISOString().slice(0,10)}}).limit(20001).lean()]);
 if([lots,bundles,events,skus,targets].some(rows=>rows.length>20000))fail('Management report exceeds capacity; reduce the window/export historical data');
 res.json(managementReport(lots,bundles,events,skus,targets,new Date(),Number(req.query.overdueDays||7)));
}));
router.post('/targets',asyncHandler(async(req,res)=>{
 if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator approval required');requireAccess(req,'STITCHING');
 res.json(await transaction(req,'TARGET',async(scope,session)=>{
  const date=clean(req.body.date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date).getTime())||new Date(date).toISOString().slice(0,10)!==date)fail('Valid target date required');
  const sku=clean(req.body.sku).toUpperCase(),operation=clean(req.body.operation),operator=clean(req.body.operator)||'Unassigned',shift=clean(req.body.shift)||'Unassigned';
  if(!await Master.exists({...scope,kind:'STITCHING',sku,operations:operation,active:{$ne:false}}).session(session))fail('Select a saved stitching operation for this SKU');
  const [target]=await Target.create([{...scope,key:req.body.key,date,sku,operation,operator,shift,quantity:pieces(req.body.quantity),createdBy:req.user.userId}],{session});return {details:{target}};
 }));
}));
router.get('/reconciliation',asyncHandler(async(req,res)=>{
 if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');
 const scope=workspaceFilter();const [lots,bundles,balances]=await Promise.all([Lot.find(scope).limit(20001).lean(),Bundle.find(scope).limit(20001).lean(),ErpBalance.find({...scope,location:{$regex:'^DPT:'}}).limit(20001).lean()]);
 if([lots,bundles,balances].some(rows=>rows.length>20000))fail('Use a smaller factory/export for reconciliation');
 res.json(departmentSummary(lots,bundles,balances));
}));
router.get('/:department/dashboard',asyncHandler(async(req,res)=>{
 const d=req.params.department;requireAccess(req,d,false);const scope=workspaceFilter();
 const [bundles,lots,masters,sales]=await Promise.all([Bundle.find({...scope,qty:{$gt:0}}).limit(10001).lean(),Lot.find({...scope,status:{$ne:'CANCELLED'}}).sort({_id:-1}).limit(2000).lean(),Master.find(scope).limit(2000).lean(),d==='MARKETING'||d==='SHOP'?Sale.find(scope).sort({_id:-1}).limit(2000).lean():[]]);
 if(bundles.length>10000)fail('Bundle report limit exceeded; archive/export history');
 const externalHistory=await Event.find({...scope,department:d,kind:{$in:['EXTERNAL_INWARD','EXTERNAL_OUTWARD','EXTERNAL_MATERIALS','INTEGRATED_CORE_TRANSFER']}}).sort({_id:-1}).limit(100).lean();const observations=d==='MARKETING'?await Event.find({...scope,kind:'EXTERNAL_MARKET_OBSERVATION'}).sort({_id:-1}).limit(100).lean():[];const coreBalances=DEPARTMENTS.slice(0,5).includes(d)?await ErpBalance.find({...scope,location:d}).limit(2000).lean():[];res.json({externalHistory,observations,coreBalances,bundles:bundles.filter(b=>(!['WAREHOUSE','TRANSIT_WAREHOUSE'].includes(b.stage)&&!b.stage.startsWith('WAREHOUSE:')||locationAllowed(req.user,'WAREHOUSE',b.destination))&&(d!=='SHOP'||allowedShop(req.user,b.destination))&&(deptFor(b.stage)===d||(d==='IRONING'&&b.stage==='GOOD')||(d==='CHECKING'&&b.stage==='REWORK'&&!enabledDepartment(req.departmentCompany,'STITCHING'))||(d==='PACKING'&&b.stage==='IRONED')||(d==='WAREHOUSE'&&b.stage==='TRANSIT_WAREHOUSE')||(d==='SHOP'&&b.stage.startsWith('TRANSIT_SHOP:'))||(d==='INWARD'&&['STITCHED','REWORK_DONE'].includes(b.stage)))),lots:['STITCHING','INWARD'].includes(d)?lots:[],masters:masters.filter(m=>d==='PACKING'?m.kind==='PACKING':d==='STITCHING'?m.kind==='STITCHING':d==='SHOP'?m.kind===d&&allowedShop(req.user,m.key):d==='WAREHOUSE'?m.kind===d&&locationAllowed(req.user,'WAREHOUSE',m.key):false),sales:d==='SHOP'?sales.filter(s=>allowedShop(req.user,s.shop)):[],department:d});
}));
router.put('/locations/:id',asyncHandler(async(req,res)=>{
 if(!['company_owner','company_admin','admin'].includes(req.user.role)||strictAccess(req.user)&&!hasPermission(req.user,'erp.masters'))throw new ApiError(403,'Location master administration required');
 if(!mongoose.isValidObjectId(req.params.id)||!clean(req.body.name))fail('Location ID and name required');
 res.json(await transaction(req,'LOCATION_DETAILS',async(scope,session)=>{const m=await Master.findOne({...scope,_id:req.params.id,kind:{$in:['WAREHOUSE','SHOP']}}).session(session);if(!m)fail('Location not found');requireAccess(req,m.kind);if(!locationAllowed(req.user,m.kind,m.key))throw new ApiError(403,'Assigned location required');const previous={name:m.name,address:m.address,contact:m.contact};m.name=clean(req.body.name);m.address=String(req.body.address||'').trim().slice(0,500);m.contact=clean(req.body.contact);await m.save({session});return {details:{locationKey:m.key,kind:m.kind,previous,current:{name:m.name,address:m.address,contact:m.contact}}};}));
}));
router.post('/masters',asyncHandler(async(req,res)=>{
 const kind=req.body.kind;requireAccess(req,kind);const scope=workspaceFilter(),sku=clean(req.body.sku).toUpperCase(),key=clean(req.body.masterKey);if(!/^[A-Za-z0-9_-]{2,60}$/.test(key))fail('Master key must be 2–60 letters/numbers/underscore/hyphen');
 if(['STITCHING','PACKING'].includes(kind)&&!await ErpSku.exists({...scope,code:sku,kind:'FINISHED',unit:{$in:['PCS','PC','PIECE','PIECES']}}))fail('A finished piece SKU is required');
 const operations=kind==='STITCHING'?names(req.body.operations||String(req.body.operationText||'').split(',')):[],materials=kind==='PACKING'?req.body.materials:[];
 if(kind==='PACKING'){packingRequirements(materials,1);if(new Set(materials.map(m=>m.sku)).size!==materials.length)fail('Duplicate packing material');for(const m of materials)if(!await ErpSku.exists({...scope,code:m.sku,kind:{$in:['RAW','CONSUMABLE']}}))fail('Packing material SKU not found');}
 if(!['STITCHING','PACKING','WAREHOUSE','SHOP'].includes(kind))fail('Unsupported master');
 res.json(await transaction(req,'MASTER',async(s,session)=>{if(await Master.exists({...s,key}).session(session))fail('Use a new master version/key');const [m]=await Master.create([{...s,key,kind,sku,name:clean(req.body.name)||key,operations,materials}],{session});return {details:{master:m}};}));
}));
router.get('/legacy-challans',asyncHandler(async(req,res)=>{
 requireAccess(req,'STITCHING',false);const scope=workspaceFilter();
 const rows=await DeliveryChallan.find({...scope,status:'ISSUED',...(req.query.planNo?{planNo:clean(req.query.planNo).toUpperCase()}:{})}).sort({_id:-1}).limit(501).lean();if(rows.length>500)fail('Filter/archive legacy challans before linking');
 const lots=await Lot.find({...scope,sourceChallanId:{$in:rows.map(c=>String(c._id))},status:{$ne:'CANCELLED'}}).lean();
 res.json(rows.map(c=>({...c,lines:c.lines.map(l=>({...l,linked:lots.filter(x=>x.sourceChallanId===String(c._id)&&x.sourceChallanLineId===String(l._id)).reduce((n,x)=>n+x.sent,0)}))})));
}));
router.post('/delivery',asyncHandler(async(req,res)=>{
 const deliveryWriter=req.body.sourceDepartment==='DELIVERY';requireAccess(req,deliveryWriter?'DELIVERY':'STITCHING');if(!enabledDepartment(req.departmentCompany,'STITCHING'))fail('Stitching is not subscribed; use Delivery external outward');if(deliveryWriter&&req.body.sourceLocation!=='DELIVERY')fail('Delivery writers must send Delivery stock');res.json(await transaction(req,'DELIVERY',async(scope,session)=>{
  const sku=clean(req.body.sku).toUpperCase(),qty=pieces(req.body.quantity),sourceLocation=req.body.sourceLocation;
  if(!['CUTTING','FINISHED','DELIVERY'].includes(sourceLocation))fail('Use reviewed CUTTING, FINISHED or DELIVERY core stock');
  const master=await Master.findOne({...scope,key:req.body.operationMaster,kind:'STITCHING',sku,active:{$ne:false}}).session(session);if(!master)fail('Stitching master required');
  const requestedRoute=await approvedRoute(req,scope,session,sku);
  const packing=await Master.findOne({...scope,key:req.body.packingMaster,kind:'PACKING',sku,active:{$ne:false}}).session(session);if(!packing&&enabledDepartment(req.departmentCompany,'PACKING')&&(!requestedRoute.routeSnapshot||requestedRoute.routeSnapshot.stages.includes('PACKING')))fail('Packing master required');
  let legacy={};
  if(req.body.sourceChallanId){
   if(sourceLocation!=='CUTTING'||!mongoose.isValidObjectId(req.body.sourceChallanId)||!mongoose.isValidObjectId(req.body.sourceChallanLineId))fail('Legacy handoff requires CUTTING stock and valid challan/line IDs');
   const challan=await DeliveryChallan.findOne({...scope,_id:req.body.sourceChallanId,status:'ISSUED'}).session(session).lean();
   const variant=await ErpSku.findOne({...scope,code:sku}).session(session).lean();
   const linked=await Lot.find({...scope,sourceChallanId:req.body.sourceChallanId}).session(session).lean();
   legacy=legacyHandoff(challan,req.body.sourceChallanLineId,variant,linked,qty);
   const plan=await FabricCutPlan.findOne({...scope,planNo:challan.planNo}).session(session).lean(),actual=await FabricCutActual.findOne({...scope,planNo:challan.planNo}).session(session).lean();
   if(!plan?.foldingSavedAt||!plan.foldingLines?.length||actual?.status!=='COMPLETED')fail('Legacy Cutting and Folding completion must be retained before linking');
  }else if(!clean(req.body.dcNo)||!clean(req.body.orderNo)||!clean(req.body.section))fail('Order, DC and section required');
  const route=requestedRoute;if(route.routeSnapshot&&route.routeSnapshot.stages[0]!=='STITCHING')fail('Delivery to stitching requires a route starting in Stitching');
  const [lot]=await Lot.create([{...scope,...route,code:await sequence(scope,session,'LOT'),sku,sent:qty,dcNo:clean(req.body.dcNo),orderNo:clean(req.body.orderNo),section:clean(req.body.section),sourceLocation,...legacy,operations:master.operations,packing:packing?.materials||[],createdBy:req.user.userId}],{session});
  const b=await newBundle(scope,session,lot,qty,'STITCHING_READY'),out=await take(scope,session,sku,sourceLocation,qty);
  const documentId=await journalMove(scope,session,req,[out,{sku,location:location(b),delta:qty*1000,value:-out.value}]);return {lotId:String(lot._id),bundleId:String(b._id),quantity:qty,documentId,details:{bundle:b}};
 }));
}));
router.post('/advance',asyncHandler(async(req,res)=>res.json(await transaction(req,'ADVANCE',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req),routingLot=await Lot.findOne({...scope,_id:b.lotId}).session(session);requireAccess(req,routeActor(routingLot,b.stage,b.stage==='GOOD'?'IRONING':['STITCHED','REWORK_DONE'].includes(b.stage)?'INWARD':deptFor(b.stage)));
 const count=pieces(req.body.quantity),lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),calculatedNext=stageAfter(b.stage,lot.operations);let next=routeAdvance(lot,b.stage,calculatedNext);
 const receiving={CHECKING:'CHECKING',GOOD:'IRONING',IRONED:'PACKING',PACKED:'DISPATCH'}[next];if(lot.routeSnapshot&&receiving&&!enabledDepartment(req.departmentCompany,receiving))fail('Approved route destination is no longer subscribed');
 if(next==='IRONING'&&!enabledDepartment(req.departmentCompany,'IRONING'))fail('Use external checking handover; ironing is not subscribed');
 if(next==='CHECKING'&&!enabledDepartment(req.departmentCompany,'CHECKING'))next='INWARD_READY';
 if(next==='PACKED'&&!lot.routeSnapshot)fail('Use packing entry to consume materials');const moved=await moveBundle(req,scope,session,b,count,next);
 if(b.stage==='STITCHED'){lot.received+=count;if(lot.received>lot.sent)fail('Original inward exceeds DC');await lot.save({session});}
 return {bundleId:String(b._id),lotId:b.lotId,quantity:count,documentId:moved.documentId,details:{bundle:moved.child,operator:clean(req.body.operator),shift:clean(req.body.shift)}};
}))));
router.post('/check',asyncHandler(async(req,res)=>{requireAccess(req,'CHECKING');res.json(await transaction(req,'CHECK',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);if(b.stage!=='CHECKING')fail('Receive into checking first');const split=checkSplit(req.body,b.qty),children=[],lot=await Lot.findOne({...scope,_id:b.lotId}).session(session);if(lot.routeSnapshot&&!lot.routeSnapshot.stages.includes('CHECKING'))fail('Checking is omitted by the approved route');
 if(lot.routeSnapshot){const nextDept=lot.routeSnapshot.stages[lot.routeSnapshot.stages.indexOf('CHECKING')+1];if(!enabledDepartment(req.departmentCompany,nextDept))fail('Route destination no longer subscribed');}
 for(const [field,stage] of [['good','GOOD'],['rework','REWORK'],['oil','OIL'],['reject','WASTE']])if(split[field]){const moved=await moveBundle(req,scope,session,b,split[field],field==='good'&&lot.routeSnapshot?routedNext(lot.routeSnapshot.stages,'CHECKING'):stage);children.push(moved.child);}
 return {bundleId:String(b._id),lotId:b.lotId,quantity:split.total,details:{split,children,defect:clean(req.body.defect)}};
 }));}));
router.post('/pack',asyncHandler(async(req,res)=>{requireAccess(req,'PACKING');res.json(await transaction(req,'PACK',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);if(b.stage!=='IRONED')fail('Only ironed bundles can be packed');const count=pieces(req.body.quantity);if(count>b.qty)fail('Packing exceeds bundle');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session);if(lot.routeSnapshot&&!lot.routeSnapshot.stages.includes('PACKING'))fail('Packing is omitted by approved route');if(req.body.packingMaster){const master=await Master.findOne({...scope,key:req.body.packingMaster,kind:'PACKING',sku:lot.sku}).session(session);if(!master)fail('Packing master required');lot.packing=master.materials;await lot.save({session});}const requirements=packingRequirements(lot.packing,count),moves=[],totalCost={value:0};
 for(const material of requirements){const m=await take(scope,session,material.sku,'ACCESSORIES',material.qty/1000);moves.push(m);totalCost.value+=-m.value;}
 const out=await take(scope,session,lot.sku,location(b),count),child=await newBundle(scope,session,lot,count,'PACKED',String(b._id));b.qty-=count;await b.save({session});
 moves.push(out,{sku:lot.sku,location:location(child),delta:count*1000,value:-out.value+totalCost.value});const documentId=await journalMove(scope,session,req,moves);return {bundleId:String(b._id),quantity:count,documentId,details:{carton:child,requirements}};
 }));}));
router.post('/transfer',asyncHandler(async(req,res)=>res.json(await transaction(req,'TRANSFER',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req),count=pieces(req.body.quantity);requireAccess(req,b.stage==='TRANSIT_WAREHOUSE'?'WAREHOUSE':b.stage.startsWith('TRANSIT_SHOP:')?'SHOP':deptFor(b.stage));let next,destination=b.destination;
 if(b.stage==='PACKED'){if(!enabledDepartment(req.departmentCompany,'WAREHOUSE'))fail('Use external outward; warehouse is not subscribed');const w=await Master.findOne({...scope,key:req.body.destination,kind:'WAREHOUSE',active:{$ne:false}}).session(session);if(!w)fail('Warehouse master required');destination=w.key;next='TRANSIT_WAREHOUSE';requireAccess(req,'DISPATCH');}
 else if(b.stage==='TRANSIT_WAREHOUSE'){requireAccess(req,'WAREHOUSE');next=`WAREHOUSE:${destination}`;}
 else if(b.stage.startsWith('WAREHOUSE:')){if(!enabledDepartment(req.departmentCompany,'SHOP'))fail('Use external outward; shop is not subscribed');const shop=await Master.findOne({...scope,key:req.body.destination,kind:'SHOP',active:{$ne:false}}).session(session);if(!shop)fail('Shop master required');destination=shop.key;next=`TRANSIT_SHOP:${destination}`;}
 else if(b.stage.startsWith('TRANSIT_SHOP:')){requireAccess(req,'SHOP');shopAccess(req,destination);next=`SHOP:${destination}`;}
 else if(b.stage.startsWith('SHOP:')){shopAccess(req,b.destination);const target=await Master.findOne({...scope,key:req.body.destination,kind:{$in:['SHOP','WAREHOUSE']}}).session(session);if(!target)fail('Shop or warehouse destination required');destination=target.key;next=target.kind==='SHOP'?`TRANSIT_SHOP:${destination}`:'TRANSIT_WAREHOUSE';}
 else fail('Unsupported transfer stage');
 bundleAccess(req,{stage:next,destination});const moved=await moveBundle(req,scope,session,b,count,next,destination);return {bundleId:String(b._id),quantity:count,documentId:moved.documentId,details:{bundle:moved.child}};
}))));
router.post('/split',asyncHandler(async(req,res)=>res.json(await transaction(req,'SPLIT',async(scope,session)=>{const b=await getBundle(req.body.bundleId,scope,session,req);requireAccess(req,deptFor(b.stage));const count=pieces(req.body.quantity);if(count>=b.qty)fail('Split must leave quantity in parent');const moved=await moveBundle(req,scope,session,b,count,b.stage,b.destination);return {bundleId:String(b._id),quantity:count,documentId:moved.documentId,details:{bundle:moved.child}};}))));
router.get('/trace/:id',asyncHandler(async(req,res)=>{const scope=workspaceFilter();if(!mongoose.isValidObjectId(req.params.id))fail('Invalid bundle');const b=await Bundle.findOne({...scope,_id:req.params.id}).lean();if(!b)fail('Bundle not found');const traceLot=await Lot.findOne({...scope,_id:b.lotId}).lean();requireAccess(req,routeActor(traceLot,b.stage,b.stage==='GOOD'&&enabledDepartment(req.departmentCompany,'IRONING')&&allowedDepartment(req.user,'IRONING',false)?'IRONING':b.stage==='IRONED'?'PACKING':b.stage==='STITCHED'||b.stage==='REWORK_DONE'?'INWARD':b.stage==='TRANSIT_WAREHOUSE'?'WAREHOUSE':b.stage.startsWith('TRANSIT_SHOP:')?'SHOP':deptFor(b.stage)),false);const lot=await Lot.findOne({...scope,_id:b.lotId}).lean();const eventScope=(b.stage.startsWith('SHOP:')||b.stage.startsWith('TRANSIT_SHOP:'))?{bundleId:String(b._id)}:{$or:[{bundleId:String(b._id)},{lotId:b.lotId}]};const events=await Event.find({...scope,...eventScope}).sort({_id:-1}).limit(500).lean();if(b.stage.startsWith('SHOP:')||b.stage.startsWith('TRANSIT_SHOP:'))shopAccess(req,b.destination);bundleAccess(req,b);res.json({bundle:b,lot:strictAccess(req.user)&&!allowedDepartment(req.user,'PACKING',false)?{...lot,packing:undefined}:lot,events:events.filter(e=>!strictAccess(req.user)||allowedDepartment(req.user,e.department,false)).map(e=>({createdAt:e.createdAt,kind:e.kind,quantity:e.quantity,actor:e.actor,operator:e.details?.operator||'',shift:e.details?.shift||''}))});}));
router.post('/sale',asyncHandler(async(req,res)=>{requireAccess(req,'SHOP');res.json(await transaction(req,'SALE',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);if(!b.stage.startsWith('SHOP:'))fail('Shop stock required');shopAccess(req,b.destination);const count=pieces(req.body.quantity);if(count>b.qty)fail('Sale exceeds stock');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),totals=saleTotals(count,req.body.unitPrice,req.body.taxPercent,req.body.discount||0),factory=req.departmentCompany.factories.find(f=>String(f._id)===String(scope.factoryId));
 if(totals.tax&&!factory?.gstin)fail('Supplier GSTIN required for GST invoice');if(!['CASH','BANK'].includes(req.body.paymentMode))fail('Select cash or bank payment');if(totals.tax&&!['CGST_SGST','IGST'].includes(req.body.taxType))fail('GST tax type required');
 const out=await take(scope,session,lot.sku,location(b),count),cost=-out.value;b.qty-=count;await b.save({session});const journals=[{account:req.body.paymentMode,debit:totals.gross,credit:0},{account:'SALES',debit:0,credit:totals.net},{account:'OUTPUT_TAX',debit:0,credit:totals.tax},{account:'COGS',debit:cost,credit:0},{account:'INVENTORY',debit:0,credit:cost}];
 const documentId=await journalMove(scope,session,req,[out],journals,totals,'RETAIL_SALE');const customer={name:clean(req.body.customerName),phone:clean(req.body.customerPhone),email:clean(req.body.customerEmail),gstin:clean(req.body.customerGstin),marketingConsent:req.body.marketingConsent===true};
 const [sale]=await Sale.create([{...scope,key:req.body.key,number:await sequence(scope,session,'POS'),shop:b.destination,sku:lot.sku,quantity:count,totals,taxPercent:Number(req.body.taxPercent||0),taxType:totals.tax?req.body.taxType:'NO_TAX',customer,supplier:{name:req.departmentCompany.companyName,address:factory?.billingAddress||factory?.address,gstin:factory?.gstin},paymentMode:req.body.paymentMode,documentId,createdBy:req.user.userId}],{session});return {bundleId:String(b._id),quantity:count,documentId,details:{sale}};
 }));}));
router.post('/return',asyncHandler(async(req,res)=>{requireAccess(req,'SHOP');res.json(await transaction(req,'RETURN',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.body.saleId))fail('Invalid sale');const sale=await Sale.findOne({...scope,_id:req.body.saleId}).session(session);if(!sale)fail('Sale not found');shopAccess(req,sale.shop);const count=pieces(req.body.quantity);if(count>sale.quantity-sale.returned)fail('Return exceeds unreturned sale');if(!clean(req.body.reason))fail('Return reason required');
 const origin=await Event.findOne({...scope,key:sale.key}).session(session),parent=await Bundle.findOne({...scope,_id:origin.bundleId}).session(session),lot=await Lot.findOne({...scope,_id:parent.lotId}).session(session),child=await newBundle(scope,session,lot,count,'CHECKING',String(parent._id));
 const document=await ErpDocument.findOne({...scope,_id:sale.documentId}).session(session),totalCost=document.journals.find(j=>j.account==='COGS').debit,remaining=count===sale.quantity-sale.returned;
 const prior=await Event.find({...scope,kind:'RETURN','details.saleId':String(sale._id)}).session(session);const used=k=>prior.reduce((n,e)=>n+(e.details.refund?.[k]||0),0);
 const net=remaining?sale.totals.net-used('net'):ratio(sale.totals.net,count,sale.quantity),tax=remaining?sale.totals.tax-used('tax'):ratio(sale.totals.tax,count,sale.quantity),cost=remaining?totalCost-prior.reduce((n,e)=>n+e.details.cost,0):ratio(totalCost,count,sale.quantity),gross=net+tax;
 const journals=[{account:sale.paymentMode,debit:0,credit:gross},{account:'SALES',debit:net,credit:0},{account:'OUTPUT_TAX',debit:tax,credit:0},{account:'COGS',debit:0,credit:cost},{account:'INVENTORY',debit:cost,credit:0}];const documentId=await journalMove(scope,session,req,[{sku:lot.sku,location:location(child),delta:count*1000,value:cost}],journals,{net:-net,tax:-tax,gross:-gross},'RETAIL_RETURN');sale.returned+=count;await sale.save({session});return {quantity:count,documentId,details:{saleId:String(sale._id),refund:{net,tax,gross},cost,bundle:child,reason:clean(req.body.reason)}};
 }));}));
router.get('/marketing/analysis',asyncHandler(async(req,res)=>{
 requireAccess(req,'MARKETING',false);const scope=workspaceFilter(),days=Number(req.query.days||30);if(!Number.isInteger(days)||days<1||days>365)fail('Analysis days 1–365');const rows=await Sale.find({...scope,createdAt:{$gte:new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate())-(days-1)*86400000)}}).limit(10001).lean();if(rows.length>10000)fail('Use smaller analysis window');const bundles=await Bundle.find({...scope,qty:{$gt:0}}).limit(10001).lean();if(bundles.length>10000)fail('Stock report exceeds limit');const lots=await Lot.find({...scope,_id:{$in:[...new Set(bundles.map(b=>b.lotId))]}}).lean(),skuBy=new Map(lots.map(l=>[String(l._id),l.sku])),group=new Map();
 for(const s of rows){const k=`${s.shop}|${s.sku}`,g=group.get(k)||{shop:s.shop,sku:s.sku,sold:0,returns:0,stock:0,inTransit:0};g.sold+=s.quantity-s.returned;g.returns+=s.returned;group.set(k,g);}
 for(const b of bundles){if(!b.stage.startsWith('SHOP:')&&!b.stage.startsWith('TRANSIT_SHOP:'))continue;const sku=skuBy.get(b.lotId),k=`${b.destination}|${sku}`,g=group.get(k)||{shop:b.destination,sku,sold:0,returns:0,stock:0,inTransit:0};g[b.stage.startsWith('SHOP:')?'stock':'inTransit']+=b.qty;group.set(k,g);}
 const scenario=req.query.method==='scenario',advanced=scenario||req.query.method==='forecast';if(advanced&&days<7)fail('Forecast requires at least seven days');
 res.json({days,note:'Reviewed planning suggestions only. Returns reduce the original sale day; dates use UTC. No automatic orders or stock reservation.',rows:[...group.values()].map(g=>({...g,...(advanced?(scenario?scenarioForecast:forecastDemand)(dailyNetSales(rows.filter(s=>s.shop===g.shop&&s.sku===g.sku),days),{leadDays:Number(req.query.leadDays??14),safety:Number(req.query.safety??0),stock:g.stock,inTransit:g.inTransit,serviceLevel:Number(req.query.serviceLevel??95),promotionMultiplier:Number(req.query.promotionMultiplier??1),seasonalMultiplier:Number(req.query.seasonalMultiplier??1),stockoutDates:String(req.query.stockoutDates||'').split(',').map(v=>v.trim()).filter(Boolean)}):{suggested:demandSuggestion(g.sold,days,Number(req.query.leadDays??14),Number(req.query.safety??0),g.stock,g.inTransit)})}))});
}));
router.get('/corrections',asyncHandler(async(req,res)=>{if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');res.json((await Event.find({...workspaceFilter(),kind:{$in:['DELIVERY','ADVANCE','CHECK','PACK','TRANSFER','SPLIT']},reversedBy:{$exists:false}}).sort({_id:-1}).limit(200).lean()).filter(e=>!strictAccess(req.user)||allowedDepartment(req.user,e.department,false)));}));
router.post('/undo',asyncHandler(async(req,res)=>{
 if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');
 res.json(await transaction(req,'UNDO',async(scope,session)=>{
  if(!mongoose.isValidObjectId(req.body.eventId)||!clean(req.body.reason)||req.body.confirm!=='UNDO MOVEMENT')fail('Select event, reason and type UNDO MOVEMENT');
  const original=await Event.findOne({...scope,_id:req.body.eventId}).session(session);if(!original||original.reversedBy||!['DELIVERY','ADVANCE','CHECK','PACK','TRANSFER','SPLIT','EXTERNAL_INWARD','EXTERNAL_OUTWARD','EXTERNAL_MATERIALS','INTEGRATED_CORE_TRANSFER'].includes(original.kind))fail('Active reversible movement required');
  requireAccess(req,original.department);const docs=await ErpDocument.find({...scope,'metadata.departmentEventKey':original.key,reversedBy:{$exists:false}}).sort({_id:-1}).session(session);if(!docs.length)fail('No reversible movement documents');
  const sourceRestore=new Map();
  for(const doc of docs){
   if(['EXTERNAL_INWARD','EXTERNAL_MATERIALS','INTEGRATED_CORE_TRANSFER'].includes(original.kind)){for(const m of doc.moves.filter(m=>m.delta>0&&!m.location.startsWith('DPT:'))){const posted=await ErpEntry.findOne({...scope,documentId:doc._id,kind:'STOCK',sku:m.sku,location:m.location}).session(session);if(!posted||await ErpEntry.exists({...scope,kind:'STOCK',sku:m.sku,location:m.location,_id:{$gt:posted._id}}).session(session))fail('Receipt destination stock has moved; reverse downstream entries first');}}
   for(const m of doc.moves.filter(m=>m.delta>0&&m.location.startsWith('DPT:'))){
    const code=m.location.split(':').at(-1),child=await Bundle.findOne({...scope,code}).session(session),balance=await ErpBalance.findOne({...scope,key:`${m.sku}@${m.location}`}).session(session);
    if(!child||child.qty*1000!==m.delta||!balance||balance.qty!==m.delta||balance.value!==m.value)fail('Child stock has moved; undo downstream movements first');
    bundleAccess(req,child);child.qty=0;await child.save({session});
   }
   for(const m of doc.moves.filter(m=>m.delta<0&&m.location.startsWith('DPT:'))){const code=m.location.split(':').at(-1);sourceRestore.set(code,(sourceRestore.get(code)||0)-m.delta/1000);}
   const reversal=await journalMove(scope,session,req,doc.moves.slice().reverse().map(m=>({sku:m.sku,location:m.location,delta:-m.delta,value:-m.value})),doc.journals.map(j=>({...j,debit:j.credit,credit:j.debit})),{net:0,tax:0,gross:0},'DEPARTMENT_CORRECTION');doc.reversedBy=reversal;await doc.save({session});
  }
  for(const [code,count] of sourceRestore){const parent=await Bundle.findOne({...scope,code}).session(session);if(!parent)fail('Source bundle unavailable');bundleAccess(req,parent);parent.qty+=count;await parent.save({session});}
  if(original.kind==='DELIVERY'||original.kind==='EXTERNAL_INWARD'&&original.lotId){await Lot.updateOne({...scope,_id:original.lotId},{$set:{status:'CANCELLED'}},{session});}
  if(original.kind==='ADVANCE'){const parent=await Bundle.findOne({...scope,_id:original.bundleId}).session(session);if(parent?.stage==='STITCHED'){const lot=await Lot.findOne({...scope,_id:parent.lotId}).session(session);if(!lot||lot.received<original.quantity)fail('Inward reconciliation required');lot.received-=original.quantity;await lot.save({session});}}
  original.reversedBy=req.body.key;await original.save({session});return {details:{eventId:String(original._id),reason:clean(req.body.reason)}};
 }));
}));
router.post('/waste-disposal',asyncHandler(async(req,res)=>{requireAccess(req,'CHECKING');if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Administrator approval required for disposal');res.json(await transaction(req,'WASTE_DISPOSAL',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session,req);if(b.stage!=='WASTE')fail('Waste bundle required');const count=pieces(req.body.quantity);if(count>b.qty||!clean(req.body.reason))fail('Valid quantity and disposal reason required');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),out=await take(scope,session,lot.sku,location(b),count),cost=-out.value;b.qty-=count;await b.save({session});const documentId=await journalMove(scope,session,req,[out],[{account:'WASTE_EXPENSE',debit:cost,credit:0},{account:'INVENTORY',debit:0,credit:cost}]);return {bundleId:String(b._id),quantity:count,documentId,details:{reason:clean(req.body.reason)}};
 }));}));
router.get('/demands',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING',false);res.json(await Demand.find(workspaceFilter()).sort({_id:-1}).limit(2000).lean());}));
router.post('/demands',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING');res.json(await transaction(req,'DEMAND',async(scope,session)=>{
 const sku=clean(req.body.sku).toUpperCase(),shop=clean(req.body.shop);if(!await ErpSku.exists({...scope,code:sku,kind:'FINISHED'}).session(session)||!await Master.exists({...scope,key:shop,kind:'SHOP'}).session(session))fail('Finished SKU and shop required');const [d]=await Demand.create([{...scope,number:await sequence(scope,session,'DEM'),sku,shop,quantity:pieces(req.body.quantity),reason:clean(req.body.reason),requestedBy:req.user.userId}],{session});return {details:{demand:d}};
 }));}));
router.post('/demands/:id/decision',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING');if(!['company_owner','admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator decision required');res.json(await transaction(req,'DEMAND_DECISION',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.params.id))fail('Invalid demand ID');const d=await Demand.findOne({...scope,_id:req.params.id}).session(session);if(!d||d.status!=='PENDING')fail('Pending demand required');if(!['APPROVED','REJECTED'].includes(req.body.status)||!clean(req.body.notes))fail('Decision and notes required');if(d.requestedBy===req.user.userId)fail('Independent decision required');d.status=req.body.status;d.decidedBy=req.user.userId;d.decisionNotes=clean(req.body.notes);await d.save({session});return {details:{demand:d}};
 }));}));
export default router;
