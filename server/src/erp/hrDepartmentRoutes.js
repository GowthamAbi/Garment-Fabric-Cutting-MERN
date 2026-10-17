import {Router} from "express";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {workspaceFilter,requestHash} from "./service.js";
import {allowedDepartment,enabledDepartment} from "./departmentPolicy.js";
import {hasPermission} from "../utils/accessPolicy.js";
import {currentDatabase} from "../config/tenantDatabase.js";
import {ErpEmployee,ErpAttendance,ErpPayslip} from "./workforce.js";
import HrActivityRecord from "../models/HrActivityRecord.js";
import {hrOverview,validateHrEmployee,validateHrAttendance,validateHrRecord} from "./hrOverviewPolicy.js";

const router=Router(),adminRoles=new Set(["company_owner","company_admin","admin"]);
const canPayroll=req=>adminRoles.has(req.user?.role)||hasPermission(req.user,"hr.payroll.read");
const idkey=x=>{const key=String(x||"").trim();
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))throw new ApiError(400,"Valid 16–100 character HR retry key required");return key;};
function requireHr(req,write=false){
 if(!enabledDepartment(req.departmentCompany,"HR")||!allowedDepartment(req.user,"HR",write))
  throw new ApiError(403,"HR department permission and subscription required");
}
router.use((req,_res,next)=>{try{requireHr(req,req.method!=="GET");next();}catch(e){next(e);}});
router.get("/overview",asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),payAllowed=canPayroll(req),period=String(req.query.period||new Date().toISOString().slice(0,7));
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new ApiError(400,"Payroll month YYYY-MM required");
 const [employees,attendance,records,payslips]=await Promise.all([
  ErpEmployee.find(scope).sort({code:1}).limit(2001).lean(),
  ErpAttendance.find(scope).sort({date:-1}).limit(10001).lean(),
  HrActivityRecord.find(scope).sort({createdAt:-1}).limit(5001).lean(),
  payAllowed?ErpPayslip.find({...scope,period}).limit(2001).lean():Promise.resolve([])
 ]);
 if(employees.length>2000||attendance.length>10000||records.length>5000||payslips.length>2000)
  throw new ApiError(409,"HR report limit reached; filter/archive before totals");
 res.json(hrOverview(employees,attendance,records,payslips,payAllowed));
}));
router.post("/employees",asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),key=idkey(req.body.key),values=validateHrEmployee(req.body);
 const hash=requestHash(values);
 await Promise.all([HrActivityRecord.init(),ErpEmployee.init()]);
 const old=await HrActivityRecord.findOne({...scope,key}).lean();
 if(old){if(old.requestHash!==hash||old.kind!=="EMPLOYEE")
  throw new ApiError(409,"HR employee retry key reused");return res.json(old);}
 const session=await currentDatabase().startSession();
 try{
  let out;
  await session.withTransaction(async()=>{
   const retry=await HrActivityRecord.findOne({...scope,key}).session(session);
   if(retry){if(retry.requestHash!==hash)throw new ApiError(409,"HR employee retry conflict");out=retry;return;}
   if(await ErpEmployee.exists({...scope,code:values.code}).session(session))
    throw new ApiError(409,"Employee code already registered in this factory");
   const [employee]=await ErpEmployee.create([{...scope,...values,active:true}],{session});
   [out]=await HrActivityRecord.create([{...scope,key,requestHash:hash,
    kind:"EMPLOYEE",employeeCode:employee.code,payload:{code:employee.code,name:employee.name},
    createdBy:req.user.userId}],{session});
  });res.status(201).json(out);
 }finally{await session.endSession();}
}));
router.post("/attendance",asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),key=idkey(req.body.key),
  rows=req.body.rows?req.body.rows:[req.body];
 if(!Array.isArray(rows)||rows.length<1||rows.length>100)
  throw new ApiError(400,"Attendance import supports 1–100 rows");
 const values=rows.map(validateHrAttendance);
 const seen=values.map(x=>x.employeeCode+"|"+x.date);
 if(new Set(seen).size!==seen.length)throw new ApiError(400,"Attendance upload contains duplicate employee/date");
 const hash=requestHash(values);
 await Promise.all([HrActivityRecord.init(),ErpAttendance.init()]);
 const session=await currentDatabase().startSession();
 try{
  let out,created=false;
  await session.withTransaction(async()=>{
   const previous=await HrActivityRecord.findOne({...scope,key}).session(session);
   if(previous){if(previous.requestHash!==hash||previous.kind!=="ATTENDANCE")
      throw new ApiError(409,"Attendance retry key reused");out=previous;return;}
   const employees=await ErpEmployee.find({...scope,code:{$in:[...new Set(values.map(x=>x.employeeCode))]},active:true}).session(session).lean();
   if(employees.length!==new Set(values.map(x=>x.employeeCode)).size)
    throw new ApiError(400,"An employee is not active in this factory");
   const before=await ErpAttendance.find({...scope,$or:values.map(x=>({employeeCode:x.employeeCode,date:x.date}))}).session(session).lean();
   if(before.length)throw new ApiError(409,"Attendance already posted for employee/date; submit a correction request");
   await ErpAttendance.insertMany(values.map(x=>({...scope,...x,recordedBy:req.user.userId})),{session});
   [out]=await HrActivityRecord.create([{...scope,key,requestHash:hash,kind:"ATTENDANCE",
    payload:{rows:values,recordCount:values.length},createdBy:req.user.userId}],{session});
   created=true;
  });
  res.status(created?201:200).json(out);
 }finally{await session.endSession();}
}));
router.post("/records",asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),key=idkey(req.body.key),values=validateHrRecord(req.body),
  hash=requestHash(values);
 await HrActivityRecord.init();
 const old=await HrActivityRecord.findOne({...scope,key}).lean();
 if(old){if(old.requestHash!==hash||old.kind!==values.kind)
  throw new ApiError(409,"HR activity key reused for different values");
  if(old.createdBy!==req.user.userId&&!adminRoles.has(req.user.role))
   throw new ApiError(403,"Activity retry belongs to another user");
  return res.json(old);
 }
 if(values.employeeCode&&!await ErpEmployee.exists({...scope,code:values.employeeCode,active:true}))
  throw new ApiError(400,"Active employee not found in this factory");
 try{
  const doc=await HrActivityRecord.create({...scope,key,requestHash:hash,...values,
   createdBy:req.user.userId});
  return res.status(201).json(doc);
 }catch(e){
  if(e.code!==11000)throw e;
  const retry=await HrActivityRecord.findOne({...scope,key}).lean();
  if(retry?.requestHash===hash&&retry.createdBy===req.user.userId)return res.json(retry);
  throw new ApiError(409,"HR activity duplicate key or conflict");
 }
}));
export default router;
