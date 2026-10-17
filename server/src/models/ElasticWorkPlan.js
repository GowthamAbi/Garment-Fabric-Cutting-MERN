import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const line=new mongoose.Schema({colour:String,size:String,actualPcs:Number,measurementMtr:Number,wantedMtr:Number},{_id:false});
const schema=new mongoose.Schema({
 planNo:{type:String,required:true,uppercase:true},dcNo:{type:String,required:true,uppercase:true},
 sku:{type:String,required:true,uppercase:true},fabricPlanNo:{type:String,required:true,uppercase:true},
 itemCode:String,itemName:String,lines:{type:[line],default:[]},
 targetMtr:{type:Number,required:true,min:0},targetPcs:{type:Number,min:0},
 status:{type:String,enum:["PLANNED","CANCELLED"],default:"PLANNED"},
 createdBy:{type:String,required:true},
},{timestamps:true});
schema.index({companyId:1,factoryId:1,planNo:1},{unique:true});
schema.index({companyId:1,factoryId:1,fabricPlanNo:1},{unique:true});
export default createTenantModel("ElasticWorkPlan",schema);
