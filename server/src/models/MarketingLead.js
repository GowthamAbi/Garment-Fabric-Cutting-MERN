import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({companyId:{type:String,required:true},
 factoryId:{type:String,required:true},key:{type:String,required:true},
 companyName:String,contactName:String,phone:String,email:String,
 source:String,notes:String,status:{type:String,default:"NEW"},createdBy:String},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
export default createTenantModel("MarketingLead",schema);
