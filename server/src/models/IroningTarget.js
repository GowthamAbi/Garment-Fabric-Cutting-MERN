import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({
 companyId:{type:String,required:true},factoryId:{type:String,required:true},
 key:{type:String,required:true},date:{type:String,required:true},
 sku:{type:String,required:true},operator:{type:String,required:true},shift:{type:String,required:true},
 quantity:{type:Number,required:true,min:1},createdBy:String
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,date:1,sku:1,operator:1,shift:1},{unique:true});
export default createTenantModel("IroningTarget",schema);
