import mongoose from "mongoose";
import {createTenantModel} from "../config/tenantDatabase.js";
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 factoryId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 key:{type:String,required:true,maxlength:100},
 planNo:{type:String,required:true,uppercase:true},
 inwardNo:{type:String,required:true,uppercase:true},
 colour:{type:String,required:true,uppercase:true},
 weightKg:{type:Number,required:true,min:0.001},
 allocations:[{bundleNo:String,batchNo:String,dia:String,weightKg:Number}],
 actorId:{type:String,required:true},
 notes:{type:String,default:"",maxlength:300}
},{timestamps:true});
schema.index({companyId:1,factoryId:1,key:1},{unique:true});
schema.index({companyId:1,factoryId:1,planNo:1,createdAt:-1});
export default createTenantModel("FabricIssueMovement",schema);
