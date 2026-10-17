import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// Append-only vendor stitched-piece acknowledgement; NOT a warehouse stock inward.
const line=new mongoose.Schema({
 colour:{type:String,required:true,uppercase:true},
 size:{type:String,required:true,uppercase:true},
 goodPcs:{type:Number,required:true,min:0},
 reworkPcs:{type:Number,required:true,min:0},
 rejectedPcs:{type:Number,required:true,min:0},
 totalPcs:{type:Number,required:true,min:1}
},{_id:false});
const schema=new mongoose.Schema({
 receiptNo:{type:String,required:true,unique:true},
 challanId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 challanNo:{type:String,required:true,uppercase:true},
 planNo:{type:String,required:true,uppercase:true},
 vendorCode:{type:String,required:true,uppercase:true},
 vendorName:{type:String,required:true},
 reference:{type:String,required:true,uppercase:true},
 remarks:{type:String,default:""},
 requestKey:{type:String,required:true,unique:true},
 requestHash:{type:String,required:true},
 lines:{type:[line],required:true},
 totalPcs:{type:Number,required:true,min:1},
 createdBy:String
},{timestamps:true});
schema.index({vendorCode:1,createdAt:-1});
schema.index({challanId:1,createdAt:-1});
export default createTenantModel("DeliveryVendorReceipt",schema);
