import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({
 sku:{type:String,required:true},expectedMtr:{type:Number,min:0,required:true},
 countedMtr:{type:Number,min:0,required:true},varianceMtr:{type:Number,required:true},
 reason:{type:String,required:true,maxlength:300},reference:{type:String,required:true},
 status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"},
 requestedBy:String,decidedBy:String,decidedAt:Date,decisionReason:String,
},{timestamps:true});
schema.index({companyId:1,factoryId:1,status:1,createdAt:-1});
schema.index({companyId:1,factoryId:1,reference:1},{unique:true});
export default createTenantModel("ElasticCorrectionRequest",schema);
