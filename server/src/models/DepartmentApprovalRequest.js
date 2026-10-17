import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
import {DEPARTMENTS} from "../../../shared/departmentCatalogue.js";
import {REQUEST_TYPES,REQUEST_STATUS} from "../services/departmentApprovalPolicy.js";

// Tenant-scoped request queue. No stock or accounting posting occurs here.
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 factoryId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 department:{type:String,enum:DEPARTMENTS,required:true},
 type:{type:String,enum:REQUEST_TYPES,required:true},
 title:{type:String,required:true,maxlength:160},
 reason:{type:String,required:true,maxlength:2000},
 reference:{type:String,maxlength:100,default:""},
 amount:{type:Number,required:true,min:0},
 status:{type:String,enum:Object.values(REQUEST_STATUS),default:REQUEST_STATUS.PENDING_HEAD},
 requestedBy:{type:mongoose.Schema.Types.ObjectId,required:true},
 decisions:[{actorId:mongoose.Schema.Types.ObjectId,decision:String,reason:String,at:Date}],
}, {timestamps:true});
schema.index({companyId:1,factoryId:1,department:1,status:1,createdAt:-1});
export default createTenantModel("DepartmentApprovalRequest",schema);
