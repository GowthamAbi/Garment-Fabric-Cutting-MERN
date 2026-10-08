import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
import { STAGES } from "./operationsPolicy.js";
const { Schema } = mongoose;
const unique = (s,key) => s.index({ companyId: 1, factoryId: 1, [key]: 1 }, { unique: true });
const machine = new Schema({ code: { type: String, required: true }, name: String, stage: { type: String, enum: STAGES }, active: { type: Boolean, default: true } }, { timestamps: true });
unique(machine,"code"); export const ErpMachine = createTenantModel("ErpMachine",machine);
const route = new Schema({ workOrderId: { type: String, required: true }, stages: [String], qty: Number, createdBy: String }, { timestamps: true });
unique(route,"workOrderId"); export const ErpRoute = createTenantModel("ErpRoute",route);
const operation = new Schema({ workOrderId: String, machineCode: String, stage: String, qty: Number, start: Date, end: Date,
  status: { type: String, enum: ["PLANNED","RUNNING","PAUSED","COMPLETE","CANCELLED"], default: "PLANNED" },
  key: { type: String, required: true }, requestHash: String,
  revision: { type: Number, default: 0 }, runMs: { type: Number, default: 0 }, pauseMs: { type: Number, default: 0 }, lastEventAt: Date,
  createdBy: String, completedBy: String }, { timestamps: true });
operation.index({ companyId: 1, factoryId: 1, machineCode: 1, start: 1 });
unique(operation,"key");
export const ErpOperation = createTenantModel("ErpOperation",operation);
const event = new Schema({ operationId: String, action: String, reason: String, notes: String, actor: String, at: Date, key: { type: String, required: true }, requestHash: String }, { timestamps: true });
unique(event,"key"); export const ErpOperationEvent = createTenantModel("ErpOperationEvent",event);
const roll = new Schema({ sku: { type: String, required: true }, receiptId: String, receiptQty: Number, rollNo: String, fabricCode: String, colour: String, dcNo: String, dia: String, setNo: String, batchNo: String, createdBy: String }, { timestamps: true });
unique(roll,"sku"); unique(roll,"rollNo"); export const ErpRoll = createTenantModel("ErpRoll",roll);
const maintenance = new Schema({ machineCode:String,title:String,dueAt:Date,blocksOperation:Boolean,
  status:{type:String,enum:["OPEN","COMPLETE"],default:"OPEN"},completedAt:Date,completedBy:String,notes:String,createdBy:String },{timestamps:true});
maintenance.index({companyId:1,factoryId:1,machineCode:1,status:1});
export const ErpMaintenance=createTenantModel("ErpMaintenance",maintenance);
export const OPERATION_MODELS = [ErpMachine,ErpRoute,ErpOperation,ErpOperationEvent,ErpRoll,ErpMaintenance];
