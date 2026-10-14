import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
import {REQUEST_TYPES} from "../services/departmentApprovalPolicy.js";

// Company-scoped approval settings. No implicit limits; missing limits deny decisions.
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},
 limits:{type:mongoose.Schema.Types.Mixed,required:true},
 revision:{type:Number,default:1,min:1},
 modifiedBy:{type:mongoose.Schema.Types.ObjectId,required:true}
},{timestamps:true});
export function validateLimits(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const levels=["HEAD","FM","OWNER"];
 if(Object.keys(input).length!==levels.length||!levels.every(k=>Object.prototype.hasOwnProperty.call(input,k)))return false;
 return levels.every(level=>{
  const row=input[level];
  return row&&typeof row==="object"&&!Array.isArray(row)&&
   Object.keys(row).length===REQUEST_TYPES.length&&
   REQUEST_TYPES.every(type=>typeof row[type]==="number"&&Number.isFinite(row[type])&&row[type]>=0&&row[type]<=1e9);
 })&&REQUEST_TYPES.every(t=>input.HEAD[t]<=input.FM[t]&&input.FM[t]<=input.OWNER[t]);
}
export default createTenantModel("CompanyApprovalSettings",schema);
