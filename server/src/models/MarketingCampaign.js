import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({companyId:{type:String,required:true},
 factoryId:{type:String,required:true},key:{type:String,required:true},
 name:String,channel:String,startDate:String,endDate:String,
 budgetPaise:Number,notes:String,createdBy:String},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
export default createTenantModel("MarketingCampaign",schema);
