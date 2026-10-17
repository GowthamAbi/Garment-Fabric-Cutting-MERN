import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({companyId:{type:String,required:true},
 factoryId:{type:String,required:true},key:{type:String,required:true},
 leadId:{type:String,required:true},kind:{type:String,required:true},
 content:String,nextFollowupDate:String,orderReference:String,sku:String,quantity:Number,createdBy:String},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
export default createTenantModel("MarketingActivity",schema);
