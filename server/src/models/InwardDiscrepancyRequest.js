import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// A review request ONLY: changing the count never updates a bundle or stock.
const schema=new mongoose.Schema({
 companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 lotId:{type:String,required:true},lotNo:String,dcNo:String,
 bundleId:{type:String,required:true},bundleCode:String,bundleStage:String,
 type:{type:String,enum:["SHORTAGE","EXCESS"],required:true},
 expectedPcs:{type:Number,required:true,min:0},
 countedPcs:{type:Number,required:true,min:0},variancePcs:{type:Number,required:true},
 reason:{type:String,required:true},status:{type:String,enum:["PENDING","APPROVED","REJECTED"],
  default:"PENDING"},createdBy:String
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,lotId:1,createdAt:-1});
export default createTenantModel("InwardDiscrepancyRequest",schema);
