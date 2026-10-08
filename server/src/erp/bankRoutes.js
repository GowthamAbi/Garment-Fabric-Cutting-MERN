import {Router} from "express";
import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {workspaceFilter} from "./service.js";
import {ErpSettings,ErpDocument} from "./models.js";
import {authorizeErp,fail} from "./policy.js";
import {parseStatement} from "./bankPolicy.js";
const schema=new mongoose.Schema({date:String,reference:String,amount:Number,documentId:String,matchedBy:String,matchedAt:Date},{timestamps:true});
schema.index({companyId:1,factoryId:1,reference:1},{unique:true});
export const ErpBankRow=createTenantModel("ErpBankRow",schema);
async function bankTransaction(fn){
 const scope=workspaceFilter();await ErpBankRow.init();const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{const setting=await ErpSettings.findOneAndUpdate({...scope,key:"ERP",enabled:true},{$inc:{revision:1}},{new:true,session});if(!setting)fail("ERP activation required");result=await fn(scope,session);});return result;}finally{await session.endSession();}
}
export async function reconcileDocument(id,input,actor){
 if(!mongoose.isValidObjectId(id))fail("Invalid document ID");
 return bankTransaction(async(scope,session)=>{
  const doc=await ErpDocument.findOne({...scope,_id:id}).session(session);if(!doc||doc.reversedBy)fail("Active bank document required");
  const bank=doc.journals.filter(l=>l.account==="BANK").reduce((s,l)=>s+l.debit-l.credit,0);
  if(!bank)fail("Document has no net bank movement");
  let row;
  if(input.rowId){if(!mongoose.isValidObjectId(input.rowId))fail("Invalid statement row ID");row=await ErpBankRow.findOne({...scope,_id:input.rowId}).session(session);}
  else{
   const date=new Date(input.clearedAt);if(!Number.isFinite(date.getTime()))fail("Invalid bank date");
   const rows=parseStatement(`date,reference,amount\n${date.toISOString().slice(0,10)},"${String(input.bankReference||"").replaceAll('"','""')}",${bank<0?"-":""}${input.amount}`);
   row=await ErpBankRow.findOne({...scope,reference:rows[0].reference}).session(session);
   if(!row){[row]=await ErpBankRow.create([{...scope,...rows[0]}],{session});}
   else if(row.amount!==rows[0].amount||row.date!==rows[0].date)fail("Bank reference is already recorded with different data");
  }
  if(!row||row.amount!==bank)fail("Signed bank statement amount must match the document");
  if(row.documentId&&row.documentId!==String(doc._id))fail("Statement movement is already matched to another document");
  if(doc.clearedAt){if(doc.bankReference===row.reference&&row.documentId===String(doc._id))return doc;fail("Document already reconciled");}
  const clearedAt=new Date(row.date+"T00:00:00Z");
  if(row.date<doc.date.toISOString().slice(0,10))fail("Clearance date precedes posting");
  if(await ErpDocument.exists({...scope,_id:{$ne:doc._id},bankReference:row.reference}).session(session))fail("Bank reference is already used");
  Object.assign(doc,{clearedAt,bankReference:row.reference});Object.assign(row,{documentId:String(doc._id),matchedBy:actor,matchedAt:new Date()});
  await doc.save({session});await row.save({session});return doc;
 });
}
const router=Router();
router.use((req,_res,next)=>authorizeErp(req.user,"finance")?next():next(new ApiError(403,"Finance permission required")));
router.get("/",asyncHandler(async(_req,res)=>res.json(await ErpBankRow.find(workspaceFilter()).sort({date:-1}).limit(2000).lean())));
router.post("/import",asyncHandler(async(req,res)=>{
 if(!authorizeErp(req.user,"reconcile"))throw new ApiError(403,"Bank reconciliation permission required");const rows=parseStatement(req.body.csv);
 res.json(await bankTransaction(async(scope,session)=>{
  let imported=0,existing=0;for(const input of rows){const previous=await ErpBankRow.findOne({...scope,reference:input.reference}).session(session);if(previous){if(previous.date!==input.date||previous.amount!==input.amount)fail("Existing bank reference has different data");existing++;}else{await ErpBankRow.create([{...scope,...input}],{session});imported++;}}return {imported,existing};
 }));
}));
router.post("/:rowId/match",asyncHandler(async(req,res)=>{
 if(!authorizeErp(req.user,"reconcile"))throw new ApiError(403,"Bank reconciliation permission required");
 res.json(await reconcileDocument(req.body.documentId,{rowId:req.params.rowId},req.user.userId));
}));
router.post("/:rowId/unmatch",asyncHandler(async(req,res)=>{
 if(!authorizeErp(req.user,"reconcile")||req.body.confirm!=="UNMATCH BANK"||!String(req.body.reason||"").trim())fail("Reconciliation permission, confirmation and reason required");
 if(!mongoose.isValidObjectId(req.params.rowId))fail("Invalid statement row ID");
 res.json(await bankTransaction(async(scope,session)=>{
  const row=await ErpBankRow.findOne({...scope,_id:req.params.rowId}).session(session);if(!row||!row.documentId)fail("Matched statement row required");
  const doc=await ErpDocument.findOne({...scope,_id:row.documentId}).session(session);if(!doc)fail("Matched document missing");
  doc.clearedAt=undefined;doc.bankReference=undefined;await doc.save({session});
  row.documentId=undefined;row.matchedBy=undefined;row.matchedAt=undefined;await row.save({session});return row;
 }));
}));
export default router;
