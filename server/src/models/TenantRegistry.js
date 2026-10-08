import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

const tenantRegistrySchema = new mongoose.Schema({
  companyKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
  enabledDepartments: [String],
  adminUserId: String,
  adminName: String,
  adminEmail: {type:String,lowercase:true,trim:true},
  activationEmailStatus: {type:String,enum:['PENDING','ACCEPTED','FAILED'],default:'PENDING'},
  activationEmailAt: Date,
    companyName: { type: String, required: true, trim: true },
  databaseName: { type: String, required: true, unique: true, immutable: true },
  loginPath: { type: String, required: true, unique: true },
  status: { type: String, enum: ["PROVISIONING", "ACTIVE", "SUSPENDED", "ARCHIVED"], default: "PROVISIONING" },
  subscriptionPlan: { type: String, enum: ["Trial", "Basic", "Professional", "Enterprise"], default: "Trial" },
  subscriptionEndsAt: Date,
  dataOwner: { type: String, default: "CUSTOMER" },
  ownerDataAccess: { type: Boolean, default: false },
  retentionLock: { type: Boolean, default: true },
  createdBy: { type: String, default: "Platform" },
}, { timestamps: true });

tenantRegistrySchema.index({ status: 1, subscriptionEndsAt: 1 });
tenantRegistrySchema.index({adminEmail:1},{unique:true,partialFilterExpression:{adminEmail:{$type:'string'}}});

const connection = controlDatabase();
export default connection.models.TenantRegistry || connection.model("TenantRegistry", tenantRegistrySchema);

