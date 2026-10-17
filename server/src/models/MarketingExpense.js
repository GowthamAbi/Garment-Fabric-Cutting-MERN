import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({companyId:{type:String,required:true},
 factoryId:{type:String,required:true},key:{type:String,required:true},
 date:String,category:String,description:String,
 reference:String,amountPaise:Number,campaignId:String,createdBy:String},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
export default createTenantModel("MarketingExpense",schema);
