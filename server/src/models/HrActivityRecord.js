import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({
 companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 kind:{type:String,required:true},employeeCode:{type:String,default:""},
 payload:mongoose.Schema.Types.Mixed,
 status:{type:String,enum:["RECORDED","PENDING","APPROVED","REJECTED"],default:"RECORDED"},
 createdBy:{type:String,required:true}
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,kind:1,employeeCode:1,createdAt:-1});
export default createTenantModel("HrActivityRecord",schema);
