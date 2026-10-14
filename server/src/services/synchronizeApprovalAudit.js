import AuditLog from "../models/AuditLog.js";
import DepartmentApprovalOutbox from "../models/DepartmentApprovalOutbox.js";

/**
 * Explicitly invoked by an authenticated, company-scoped administrator route.
 * The source outbox and destination AuditLog may use different MongoDB clients.
 * The unique sourceEventId makes retries safe if delivery marking fails.
 */
export async function synchronizeApprovalAudit({companyId,factoryId,limit=50}){
 if(!companyId||!factoryId)throw new Error("Company/factory context is required");
 const events=await DepartmentApprovalOutbox.find({
  companyId,factoryId,deliveredAt:null
 }).sort({createdAt:1,_id:1}).limit(Math.min(100,Math.max(1,limit))).lean();
 let delivered=0;
 for(const event of events){
  const sourceEventId="approval:"+String(companyId)+":"+String(event._id);
  const document={
   sourceEventId,actorId:event.actorId,actorRole:"approval-workflow",
   action:"APPROVAL_"+event.eventType,
   entity:"DepartmentApprovalRequest",entityId:String(event.requestId),
   changes:{companyId:String(event.companyId),factoryId:String(event.factoryId),eventType:event.eventType,payload:event.payload},
   method:"SYSTEM",path:"/internal/approval-audit-sync"
  };
  try{
   await AuditLog.updateOne({sourceEventId},{$setOnInsert:document},{upsert:true});
  }catch(error){
   if(error.code!==11000)throw error;
   const existing=await AuditLog.exists({sourceEventId});
   if(!existing)throw error;
  }
  const result=await DepartmentApprovalOutbox.updateOne({_id:event._id,companyId,factoryId,deliveredAt:null},{$set:{deliveredAt:new Date()}});
  delivered+=result.modifiedCount||0;
 }
 return {processed:events.length,delivered};
}
