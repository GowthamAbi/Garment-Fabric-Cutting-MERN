import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// Audit request only; PACKED stock cannot be reclassified without a posted movement.
const schema=new mongoose.Schema({
 companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 lotId:{type:String,required:true},lotNo:String,dcNo:String,
 bundleId:{type:String,required:true},cartonNo:String,
 category:{type:String,required:true},quantity:{type:Number,required:true},
 expectedPcs:{type:Number,required:true},stage:{type:String,required:true},
 reason:{type:String,required:true},
 status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"},
 requestedBy:String
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,bundleId:1,createdAt:-1});
export default createTenantModel("PackingRepackRequest",schema);
