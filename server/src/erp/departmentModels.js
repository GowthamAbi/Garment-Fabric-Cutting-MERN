import mongoose from 'mongoose';
import {createTenantModel} from '../config/tenantDatabase.js';
const S=mongoose.Schema;
function model(name,fields,keys=[]){const s=new S(fields,{timestamps:true});for(const key of keys)s.index({companyId:1,factoryId:1,[key]:1},{unique:true});return createTenantModel(name,s);}
export const DepartmentMaster=model('DepartmentMaster',{key:String,kind:String,sku:String,name:String,version:Number,operations:[String],materials:[S.Types.Mixed],active:{type:Boolean,default:true}},['key']);
export const DepartmentLot=model('DepartmentLot',{code:String,status:{type:String,default:'ACTIVE'},sku:String,orderNo:String,dcNo:String,section:String,sent:Number,received:{type:Number,default:0},operations:[String],packing:[S.Types.Mixed],sourceLocation:String,createdBy:String},['code']);
export const DepartmentBundle=model('DepartmentBundle',{code:String,lotId:String,parentId:String,qty:Number,stage:String,destination:String,cycle:{type:Number,default:0},createdBy:String},['code']);
export const DepartmentEvent=model('DepartmentEvent',{key:String,requestHash:String,reversedBy:String,department:String,kind:String,lotId:String,bundleId:String,quantity:Number,details:S.Types.Mixed,documentId:String,actor:String},['key']);
export const RetailSale=model('RetailSale',{key:String,number:String,shop:String,sku:String,quantity:Number,returned:{type:Number,default:0},totals:S.Types.Mixed,taxPercent:Number,taxType:String,customer:S.Types.Mixed,supplier:S.Types.Mixed,paymentMode:String,documentId:String,createdBy:String},['key','number']);
export const DepartmentDemand=model('DepartmentDemand',{number:String,sku:String,shop:String,quantity:Number,reason:String,status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING'},requestedBy:String,decidedBy:String,decisionNotes:String},['number']);
export const DEPARTMENT_MODELS=[DepartmentMaster,DepartmentLot,DepartmentBundle,DepartmentEvent,RetailSale,DepartmentDemand];
