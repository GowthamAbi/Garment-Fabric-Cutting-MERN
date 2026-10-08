import { Router } from "express";
import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { workspaceFilter, requestHash } from "./service.js";
import { authorizeErp, money, safeInteger, fail } from "./policy.js";
import Company from "../models/Company.js";
const {Schema}=mongoose;
const employeeSchema=new Schema({code:{type:String,required:true},name:String,department:String,designation:String,active:{type:Boolean,default:true}},{timestamps:true});
employeeSchema.index({companyId:1,factoryId:1,code:1},{unique:true});
export const ErpEmployee=createTenantModel("ErpEmployee",employeeSchema);
const attendanceSchema=new Schema({employeeCode:String,date:String,status:{type:String,enum:["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"]},notes:String,recordedBy:String},{timestamps:true});
attendanceSchema.index({companyId:1,factoryId:1,employeeCode:1,date:1},{unique:true});
export const ErpAttendance=createTenantModel("ErpAttendance",attendanceSchema);
const slipSchema=new Schema({employeeCode:String,period:String,key:String,requestHash:String,employee:Schema.Types.Mixed,company:Schema.Types.Mixed,amounts:Schema.Types.Mixed,gross:Number,deductions:Number,net:Number,
 attendance:Schema.Types.Mixed,notes:String,createdBy:String,status:{type:String,enum:["POSTED","VOID"],default:"POSTED"},voidReason:String,voidBy:String,voidAt:Date},{timestamps:true});
slipSchema.index({companyId:1,factoryId:1,key:1},{unique:true});
slipSchema.index({companyId:1,factoryId:1,employeeCode:1,period:1},{unique:true,partialFilterExpression:{status:"POSTED"}});
slipSchema.pre("save",function(){if(!this.isNew&&this.modifiedPaths().some(p=>!["status","voidReason","voidBy","voidAt","updatedAt","updatedBy"].includes(p)))fail("Payslip is immutable; void and correct it");});
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
  const [employees,attendance,payslips]=await Promise.all([ErpEmployee.find(scope).limit(2000).lean(),ErpAttendance.find({...scope,date:{$gte:period+"-01",$lte:period+"-31"}}).limit(10000).lean(),ErpPayslip.find({...scope,period}).limit(2000).lean()]);
  res.json({employees,attendance,payslips,period});
}));
const write=(req,_res,next)=>authorizeErp(req.user,"post","WORK_COST")?next():next(new ApiError(403,"Accounts posting permission required"));
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
  const pay=calculatePay(req.body),notes=String(req.body.notes||"").slice(0,1000),hash=requestHash({employeeCode,period,...pay,notes});
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
router.post("/payslips/:id/void",write,asyncHandler(async(req,res)=>{
  if(!["company_admin","admin"].includes(req.user.role)||req.body.confirm!=="VOID PAYSLIP"||!String(req.body.reason||"").trim())fail("Administrator confirmation and void reason required");
  if(!mongoose.isValidObjectId(req.params.id))fail("Invalid payslip ID");
  const slip=await ErpPayslip.findOne({...workspaceFilter(),_id:req.params.id});if(!slip)fail("Payslip not found");if(slip.status==="VOID")return res.json(slip);
  Object.assign(slip,{status:"VOID",voidReason:String(req.body.reason).slice(0,1000),voidBy:actor(req),voidAt:new Date()});await slip.save();res.json(slip);
}));
export default router;
