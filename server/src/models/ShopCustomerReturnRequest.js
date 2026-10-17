import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
// Non-posting customer return review. The existing ERP /return performs
// independent posted refund and CHECKING movement only after review.
const schema=new mongoose.Schema({
 companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},requestHash:{type:String,required:true},
 saleId:{type:String,required:true},invoice:String,shop:{type:String,required:true},sku:String,
 quantity:{type:Number,required:true,min:1},kind:{type:String,required:true},
 reason:{type:String,required:true},status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"},
 unreturnedAtRequest:{type:Number,required:true},otherPendingAtRequest:{type:Number,default:0},
 requestedBy:String
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,saleId:1,status:1});
export default createTenantModel("ShopCustomerReturnRequest",schema);
