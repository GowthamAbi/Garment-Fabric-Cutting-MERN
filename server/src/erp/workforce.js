import { Router } from "express";
import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { workspaceFilter, requestHash } from "./service.js";
import { authorizeErp, money, safeInteger, fail } from "./policy.js";
import Company from "../models/Company.js";
import { payrollRule, calculateRulePay, payrollAccrual } from "./payrollPolicy.js";
import { featureAllowed } from "./featurePolicy.js";
import { statutoryRoutes } from './statutoryRoutes.js';
import { currentDatabase } from "../config/tenantDatabase.js";
import { ErpSettings, ErpDocument, ErpEntry, ErpSequence } from "./models.js";
const {Schema}=mongoose;
const ruleSchema=new Schema({key:String,reviewReference:String,effectiveFrom:String,effectiveTo:String,pfBasis:String,pfCap:Number,esiEligibilityCeiling:Number,employeePfBps:Number,employerPfBps:Number,employeeEsiBps:Number,employerEsiBps:Number,createdBy:String},{timestamps:true});
ruleSchema.index({companyId:1,factoryId:1,key:1},{unique:true});
export const ErpPayrollRule=createTenantModel("ErpPayrollRule",ruleSchema);
const employeeSchema=new Schema({code:{type:String,required:true},name:String,department:String,designation:String,active:{type:Boolean,default:true}},{timestamps:true});
employeeSchema.index({companyId:1,factoryId:1,code:1},{unique:true});
export const ErpEmployee=createTenantModel("ErpEmployee",employeeSchema);
const attendanceSchema=new Schema({employeeCode:String,date:String,status:{type:String,enum:["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"]},notes:String,recordedBy:String},{timestamps:true});
attendanceSchema.index({companyId:1,factoryId:1,employeeCode:1,date:1},{unique:true});
export const ErpAttendance=createTenantModel("ErpAttendance",attendanceSchema);
const slipSchema=new Schema({employeeCode:String,period:String,key:String,requestHash:String,employee:Schema.Types.Mixed,company:Schema.Types.Mixed,amounts:Schema.Types.Mixed,gross:Number,deductions:Number,net:Number,
 accountingDocumentId:String,accountingReversedBy:String,calculation:Schema.Types.Mixed,attendance:Schema.Types.Mixed,notes:String,createdBy:String,status:{type:String,enum:["POSTED","VOID"],default:"POSTED"},voidReason:String,voidBy:String,voidAt:Date},{timestamps:true});
slipSchema.index({companyId:1,factoryId:1,key:1},{unique:true});
slipSchema.index({companyId:1,factoryId:1,employeeCode:1,period:1},{unique:true,partialFilterExpression:{status:"POSTED"}});
slipSchema.pre("save",function(){if(!this.isNew&&this.modifiedPaths().some(p=>!["status","voidReason","voidBy","voidAt","accountingDocumentId","accountingReversedBy","updatedAt","updatedBy"].includes(p)))fail("Payslip is immutable; void and correct it");});
export const ErpPayslip=createTenantModel("ErpPayslip",slipSchema);
export function calculatePay(body){
  const amounts=Object.fromEntries(["basic","allowance","overtime","pf","esi","tax","otherDeduction"].map(k=>[k,money(body[k]??0)]));
  const gross=safeInteger(amounts.basic+amounts.allowance+amounts.overtime),deductions=safeInteger(amounts.pf+amounts.esi+amounts.tax+amounts.otherDeduction);
  if(deductions>gross)fail("Deductions exceed gross earnings");return {amounts,gross,deductions,net:gross-deductions};
}
const router=Router();
const actor=req=>req.user.userId||String(req.user._id);
router.use((req,_res,next)=>authorizeErp(req.user,"finance")?next():next(new ApiError(403,"Company finance permission required for workforce records")));
router.get("/",asyncHandler(async(req,res)=>{
  const scope=workspaceFilter(),period=String(req.query.period||new Date().toISOString().slice(0,7));if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))fail("Invalid payroll month");
  const [employees,attendance,payslips,rules]=await Promise.all([ErpEmployee.find(scope).limit(2000).lean(),ErpAttendance.find({...scope,date:{$gte:period+"-01",$lte:period+"-31"}}).limit(10000).lean(),ErpPayslip.find({...scope,period}).limit(2000).lean(),ErpPayrollRule.find(scope).sort({createdAt:-1}).limit(200).lean()]);
  res.json({employees,attendance,payslips,rules,period});
}));
const write=(req,_res,next)=>authorizeErp(req.user,"post","WORK_COST")?next():next(new ApiError(403,"Accounts posting permission required"));
router.use('/statutory',write);
router.use(statutoryRoutes(ErpPayslip));
router.post("/payroll-rules",write,asyncHandler(async(req,res)=>{
 if(!["company_admin","admin"].includes(req.user.role))throw new ApiError(403,"Company administrator must approve payroll rules");
 const rule=payrollRule(req.body);await ErpPayrollRule.init();
 if(await ErpPayrollRule.exists({...workspaceFilter(),key:rule.key}))fail("Use a new immutable payroll rule version");
 res.status(201).json(await ErpPayrollRule.create({...workspaceFilter(),...rule,createdBy:actor(req)}));
}));
async function reviewedPay(body,period){
 if(!body.payrollRuleKey)return calculatePay(body);
 const rule=await ErpPayrollRule.findOne({...workspaceFilter(),key:body.payrollRuleKey}).lean();if(!rule)fail("Payroll rule not found");
 const {companyId,factoryId,_id,__v,createdAt,updatedAt,createdBy,...snapshot}=rule;
 return calculateRulePay(body,snapshot,period);
}
router.post("/payroll-preview",write,asyncHandler(async(req,res)=>res.json(await reviewedPay(req.body,String(req.body.period||"")))));
router.post("/employees",write,asyncHandler(async(req,res)=>{
  const code=String(req.body.code||"").trim().toUpperCase(),name=String(req.body.name||"").trim();if(!/^[A-Z0-9_-]{2,60}$/.test(code)||!name)fail("Employee code and name required");
  res.status(201).json(await ErpEmployee.create({...workspaceFilter(),code,name:name.slice(0,120),department:String(req.body.department||"").slice(0,60),designation:String(req.body.designation||"").slice(0,100)}));
}));
router.post("/attendance",write,asyncHandler(async(req,res)=>{
  const scope=workspaceFilter(),employeeCode=String(req.body.employeeCode||""),date=String(req.body.date||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date).getTime())||new Date(date).toISOString().slice(0,10)!==date||!["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"].includes(req.body.status))fail("Valid attendance date and status required");
  if(!await ErpEmployee.exists({...scope,code:employeeCode,active:true}))fail("Employee not found");
  res.json(await ErpAttendance.findOneAndUpdate({...scope,employeeCode,date},{$set:{...scope,employeeCode,date,status:req.body.status,notes:String(req.body.notes||"").slice(0,500),recordedBy:actor(req)}},{upsert:true,new:true,runValidators:true}));
}));
router.post("/payslips",write,asyncHandler(async(req,res)=>{
  const scope=workspaceFilter(),period=String(req.body.period||""),employeeCode=String(req.body.employeeCode||""),key=req.get("Idempotency-Key");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||! /^[A-Za-z0-9_-]{16,100}$/.test(key||""))fail("Payroll period and idempotency key required");
  const pay=await reviewedPay(req.body,period),notes=String(req.body.notes||"").slice(0,1000),hash=requestHash({employeeCode,period,...pay,notes});
  await ErpPayslip.init();const existing=await ErpPayslip.findOne({...scope,key}).lean();
  if(existing){if(existing.requestHash!==hash)fail("Idempotency key has different payroll data");return res.json(existing);}
  const employee=await ErpEmployee.findOne({...scope,code:employeeCode,active:true}).lean();if(!employee)fail("Active employee required");
  const company=await Company.findById(scope.companyId).lean(),factory=company?.factories?.find(f=>String(f._id)===String(scope.factoryId));
  const companySnapshot={name:company?.companyName||"Company",factory:factory?.name||"",address:factory?.billingAddress||company?.address||""};
  const rows=await ErpAttendance.find({...scope,employeeCode,date:{$gte:period+"-01",$lte:period+"-31"}}).lean();
  const attendance=Object.fromEntries(["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"].map(s=>[s,rows.filter(r=>r.status===s).length]));
  try{res.json(await ErpPayslip.create({...scope,employeeCode,period,key,requestHash:hash,company:companySnapshot,employee:{name:employee.name,department:employee.department,designation:employee.designation},...pay,notes,attendance,createdBy:actor(req)}));}
  catch(e){if(e.code!==11000)throw e;const duplicate=await ErpPayslip.findOne({...scope,key}).lean();if(duplicate?.requestHash===hash)return res.json(duplicate);fail("A posted payslip already exists for this employee/month; review or void before correction");}
}));
const payrollFinance=asyncHandler(async(req,_res,next)=>{const company=await Company.findById(workspaceFilter().companyId).lean();if(!company||!featureAllowed(company.entitlements?.modules,"ERP_FINANCE"))throw new ApiError(403,"ERP Finance subscription required for payroll accounting");next();});
router.post("/payslips/:id/accrual",write,payrollFinance,asyncHandler(async(req,res)=>{
 if(!["company_admin","admin"].includes(req.user.role)||req.body.confirm!=="POST PAYROLL"||!mongoose.isValidObjectId(req.params.id))fail("Administrator confirmation POST PAYROLL required");
 const scope=workspaceFilter();await Promise.all([ErpDocument,ErpEntry,ErpSequence,ErpPayslip].map(m=>m.init()));
 const session=await currentDatabase().startSession();let result;
 try{await session.withTransaction(async()=>{
  if(!await ErpSettings.findOneAndUpdate({...scope,key:"ERP",enabled:true},{$inc:{revision:1}},{session}))fail("ERP activation required");
  const slip=await ErpPayslip.findOne({...scope,_id:req.params.id}).session(session);if(!slip||slip.status!=="POSTED")fail("Posted payslip required");
  if(slip.accountingDocumentId){result=await ErpDocument.findOne({...scope,_id:slip.accountingDocumentId}).session(session).lean();return;}
  const journals=payrollAccrual(slip),sequence=await ErpSequence.findOneAndUpdate({...scope,key:"PAYROLL"},{$inc:{value:1}},{upsert:true,new:true,session});
  const id=new mongoose.Types.ObjectId(),date=new Date(),number=`PAY-${String(sequence.value).padStart(8,"0")}`;
  [result]=await ErpDocument.create([{...scope,_id:id,number,date,type:"PAYROLL_ACCRUAL",sourceId:String(slip._id),idempotencyKey:`payroll_${slip._id}`,requestHash:requestHash(journals),lines:[],moves:[],journals,totals:{net:slip.net,tax:0,gross:slip.gross},metadata:{payrollManaged:true,employeeCode:slip.employeeCode,period:slip.period},postedBy:actor(req),notes:"Reviewed salary accrual; not a salary payment"}],{session});
  await ErpEntry.insertMany(journals.map(j=>({...scope,documentId:id,documentNo:number,date,kind:"JOURNAL",party:slip.employeeCode,...j})),{session});
  slip.accountingDocumentId=String(id);await slip.save({session});
 });res.json(result);}finally{await session.endSession();}
}));
router.post("/payslips/:id/reverse-accrual",write,payrollFinance,asyncHandler(async(req,res)=>{
 if(!["company_admin","admin"].includes(req.user.role)||req.body.confirm!=="REVERSE PAYROLL"||!mongoose.isValidObjectId(req.params.id)||!String(req.body.reason||"").trim())fail("Administrator confirmation and reversal reason required");
 const scope=workspaceFilter(),session=await currentDatabase().startSession();let result;
 try{await session.withTransaction(async()=>{
  if(!await ErpSettings.findOneAndUpdate({...scope,key:"ERP",enabled:true},{$inc:{revision:1}},{session}))fail("ERP activation required");
  const slip=await ErpPayslip.findOne({...scope,_id:req.params.id}).session(session);if(!slip?.accountingDocumentId)fail("Payroll accrual not found");
  if(slip.accountingReversedBy){result=await ErpDocument.findOne({...scope,_id:slip.accountingReversedBy}).session(session).lean();return;}
  const original=await ErpDocument.findOne({...scope,_id:slip.accountingDocumentId}).session(session);if(!original||original.reversedBy||original.clearedAt)fail("Unreversed, uncleared payroll accrual required");
  if(await ErpDocument.exists({...scope,sourceId:String(original._id),reversedBy:{$exists:false}}).session(session))fail("Reverse linked payroll settlement first");
  const sequence=await ErpSequence.findOneAndUpdate({...scope,key:"PAYROLL"},{$inc:{value:1}},{upsert:true,new:true,session}),id=new mongoose.Types.ObjectId(),date=new Date(),number=`PAY-${String(sequence.value).padStart(8,"0")}`,journals=original.journals.map(j=>({...j,debit:j.credit,credit:j.debit}));
  [result]=await ErpDocument.create([{...scope,_id:id,number,date,type:"REVERSAL",sourceId:String(original._id),idempotencyKey:`payroll_reverse_${slip._id}`,requestHash:requestHash(journals),lines:[],moves:[],journals,totals:original.totals,metadata:{payrollManaged:true,reverses:String(original._id)},postedBy:actor(req),notes:String(req.body.reason).slice(0,1000)}],{session});
  await ErpEntry.insertMany(journals.map(j=>({...scope,documentId:id,documentNo:number,date,kind:"JOURNAL",party:slip.employeeCode,...j})),{session});
  original.reversedBy=String(id);await original.save({session});slip.accountingReversedBy=String(id);await slip.save({session});
 });res.json(result);}finally{await session.endSession();}
}));
router.post("/payslips/:id/void",write,asyncHandler(async(req,res)=>{
  if(!["company_admin","admin"].includes(req.user.role)||req.body.confirm!=="VOID PAYSLIP"||!String(req.body.reason||"").trim())fail("Administrator confirmation and void reason required");
  if(!mongoose.isValidObjectId(req.params.id))fail("Invalid payslip ID");
  await ErpSettings.init();const scope=workspaceFilter(),session=await currentDatabase().startSession();let result;
  try{await session.withTransaction(async()=>{
   await ErpSettings.findOneAndUpdate({...scope,key:"ERP"},{$inc:{revision:1}},{upsert:true,new:true,session});
   const slip=await ErpPayslip.findOne({...scope,_id:req.params.id}).session(session);if(!slip)fail("Payslip not found");if(slip.status==="VOID"){result=slip;return;}
   if(slip.accountingDocumentId&&!slip.accountingReversedBy)fail("Reverse the linked payroll accrual before voiding this payslip");
   Object.assign(slip,{status:"VOID",voidReason:String(req.body.reason).slice(0,1000),voidBy:actor(req),voidAt:new Date()});await slip.save({session});result=slip;
  });res.json(result);}finally{await session.endSession();}
}));
export default router;
