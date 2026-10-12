import mongoose from 'mongoose';
import {createTenantModel} from '../config/tenantDatabase.js';
const schema=new mongoose.Schema({companyId:{type:mongoose.Schema.Types.ObjectId,required:true},key:{type:String,required:true},name:String,baseRole:String,permissions:[String],createdBy:String},{timestamps:true,platformRegistry:true});
schema.index({companyId:1,key:1},{unique:true});
export default createTenantModel('AccessRole',schema);
