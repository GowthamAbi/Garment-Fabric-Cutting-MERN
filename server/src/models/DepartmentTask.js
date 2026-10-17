import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
import {TASK_PRIORITIES,TASK_STATUSES} from "../erp/departmentTaskPolicy.js";
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 factoryId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 department:{type:String,required:true,uppercase:true,index:true},
 title:{type:String,required:true,trim:true,maxlength:160},
 notes:{type:String,default:"",maxlength:1000},
 reference:{type:String,default:"",maxlength:100},
 priority:{type:String,enum:TASK_PRIORITIES,default:"NORMAL"},
 status:{type:String,enum:TASK_STATUSES,default:"PENDING"},
 assigneeId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 assigneeName:{type:String,required:true,maxlength:120},
 createdById:{type:mongoose.Schema.Types.ObjectId,required:true},
 createdByName:{type:String,maxlength:120},
 dueAt:Date,
 startedAt:Date,
 completedAt:Date,
 lastUpdatedById:mongoose.Schema.Types.ObjectId
},{timestamps:true,versionKey:false});
schema.index({companyId:1,factoryId:1,department:1,createdAt:-1});
schema.index({companyId:1,factoryId:1,department:1,assigneeId:1,status:1});
export default createTenantModel("DepartmentTask",schema);
