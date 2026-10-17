import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// Non-posting review request, not an inventory adjustment/hold.
const s=new mongoose.Schema({companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 lotId:{type:String,required:true},lotNo:String,dcNo:String,
 bundleId:{type:String,required:true},cartonNo:String,
 stage:{type:String,required:true},availablePcs:{type:Number,required:true},
 category:{type:String,required:true},quantity:{type:Number,required:true},
 reason:{type:String,required:true},status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"},
 requestedBy:String},{timestamps:true});
s.index({companyId:1,factoryId:1,key:1},{unique:true});
s.index({companyId:1,factoryId:1,bundleId:1,createdAt:-1});
export default createTenantModel("DispatchExceptionRequest",s);
