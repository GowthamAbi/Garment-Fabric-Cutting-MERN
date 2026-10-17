import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const s=new mongoose.Schema({companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 date:{type:String,required:true},sku:{type:String,required:true},dcNo:{type:String,default:""},
 destination:{type:String,required:true},quantity:{type:Number,required:true,min:1},
 notes:{type:String,default:""},createdBy:String},{timestamps:true});
s.index({companyId:1,factoryId:1,key:1},{unique:true});
s.index({companyId:1,factoryId:1,date:1,sku:1,dcNo:1,destination:1},{unique:true});
export default createTenantModel("DispatchSchedule",s);
