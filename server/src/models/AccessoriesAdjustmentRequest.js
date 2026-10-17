import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({
  sku:{type:String,required:true,uppercase:true},
  expectedQty:{type:Number,required:true,min:0},
  countedQty:{type:Number,required:true,min:0},
  varianceQty:{type:Number,required:true},
  reason:{type:String,required:true,maxlength:300},
  status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"},
  requestedBy:{type:String,required:true},
  decidedBy:String,decidedAt:Date,decisionReason:String,
},{timestamps:true});
schema.index({companyId:1,factoryId:1,status:1,createdAt:-1});
export default createTenantModel("AccessoriesAdjustmentRequest",schema);
