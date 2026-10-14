import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";

// Operational outbox: co-located with DepartmentApprovalRequest in the same tenant DB.
// A separate audited dispatcher can mirror these events to platform audit logs later.
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 factoryId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 requestId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 eventType:{type:String,enum:["REQUEST_CREATED","DECISION_RECORDED"],required:true},
 actorId:{type:mongoose.Schema.Types.ObjectId,required:true},
 payload:{type:mongoose.Schema.Types.Mixed,required:true},
 deliveredAt:{type:Date,default:null}
},{timestamps:true});
schema.index({companyId:1,requestId:1,createdAt:1});
export default createTenantModel("DepartmentApprovalOutbox",schema);
