import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// Unique movement key makes an HTTP retry read the previous committed movement.
const schema=new mongoose.Schema({
 key:{type:String,required:true,unique:true},
 requestHash:{type:String,required:true},actorUserId:{type:String,required:true},
 mode:{type:String,enum:["REWORK","DELIVER"],required:true},
 sourceId:{type:mongoose.Schema.Types.ObjectId,required:true},
 destinationId:{type:mongoose.Schema.Types.ObjectId,required:true},
 quantity:{type:Number,required:true,min:1}
},{timestamps:true});
export default createTenantModel("LegacyWarehouseMovement",schema);
