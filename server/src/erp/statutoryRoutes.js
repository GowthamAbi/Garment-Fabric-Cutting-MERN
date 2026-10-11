import { Router } from 'express';
import mongoose from 'mongoose';
import { createTenantModel,currentDatabase } from '../config/tenantDatabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { workspaceFilter,requestHash } from './service.js';
import { fail,money } from './policy.js';
import { statutoryReport } from './statutoryReport.js';
import { ErpSettings } from './models.js';
const schema=new mongoose.Schema({period:String,kind:String,reportHash:String,amount:Number,reviewReference:String,requestedBy:String,
  active:{type:Boolean,default:true},status:{type:String,enum:['PENDING','RECORDED','REJECTED'],default:'PENDING'},decidedBy:String,portalReference:String,paymentReference:String,decisionNotes:String},{timestamps:true});
schema.index({companyId:1,factoryId:1,period:1,kind:1},{unique:true,partialFilterExpression:{active:true}});
export const StatutoryRegister=createTenantModel('ErpStatutoryRegister',schema);
export function statutoryRoutes(Payslip){
 const router=Router(),actor=req=>req.user.userId||String(req.user._id);
 const admin=req=>{if(!['admin','company_admin'].includes(req.user.role))fail('Company administrator required');};
 const report=async(period,session)=>{let query=Payslip.find({...workspaceFilter(),period,status:'POSTED'}).limit(2001);if(session)query=query.session(session);const slips=await query.lean();if(slips.length>2000)fail('Report exceeds 2000 payslips');const result=statutoryReport(slips,period);return {...result,reportHash:requestHash(result.rows)};};
 router.get('/statutory',asyncHandler(async(req,res)=>{admin(req);const period=String(req.query.period||'');const data=await report(period),register=await StatutoryRegister.find({...workspaceFilter(),period}).lean();res.json({...data,register:register.map(row=>({...row,payrollChanged:row.reportHash!==data.reportHash}))});}));
 router.post('/statutory',asyncHandler(async(req,res)=>{admin(req);const period=String(req.body.period||''),kind=String(req.body.kind||''),reviewReference=String(req.body.reviewReference||'').trim();if(!['PF','ESI','TDS'].includes(kind)||!reviewReference||reviewReference.length>500)fail('Contribution kind and accountant review reference required');const data=await report(period);if(!data.rows.length||!data.totals[kind])fail('No contribution payable in this review pack');await StatutoryRegister.init();res.status(201).json(await StatutoryRegister.create({...workspaceFilter(),period,kind,reportHash:data.reportHash,amount:data.totals[kind],reviewReference,requestedBy:actor(req)}));}));
 router.post('/statutory/:id/decision',asyncHandler(async(req,res)=>{
  admin(req);if(!mongoose.isValidObjectId(req.params.id))fail('Invalid register reference');const status=String(req.body.status||'');if(!['RECORDED','REJECTED'].includes(status))fail('Select record or reject');
  const scope=workspaceFilter(),session=await currentDatabase().startSession();let result;
  try{await session.withTransaction(async()=>{
   if(!await ErpSettings.findOneAndUpdate({...scope,key:'ERP',enabled:true},{$inc:{revision:1}},{session}))fail('ERP activation required');
   const row=await StatutoryRegister.findOne({...scope,_id:req.params.id}).session(session);if(!row||row.status!=='PENDING')fail('Pending register required');if(row.requestedBy===actor(req))fail('A different administrator must verify filing/payment evidence');
   const notes=String(req.body.decisionNotes||'').trim();if(!notes||notes.length>1000)fail('Decision notes required');
   if(status==='RECORDED'){
    const data=await report(row.period,session);if(data.reportHash!==row.reportHash||data.totals[row.kind]!==row.amount)fail('Payroll changed; reject this pack and review the corrected period');
    if(money(req.body.amount)!==row.amount)fail('Recorded amount must match the reviewed contribution total');
    for(const field of ['portalReference','paymentReference']){const value=String(req.body[field]||'').trim();if(!value||value.length>200)fail('Portal filing and bank payment references required');row[field]=value;}
   }
   row.status=status;row.active=status!=='REJECTED';row.decidedBy=actor(req);row.decisionNotes=notes;await row.save({session});result=row;
  });res.json(result);}finally{await session.endSession();}
 }));return router;
}
