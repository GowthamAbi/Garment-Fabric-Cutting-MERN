import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const { Schema } = mongoose;
const scopedUnique = (schema, field) => schema.index({ companyId: 1, factoryId: 1, [field]: 1 }, { unique: true });
function immutable(schema) {
  schema.pre("save", function () { if (!this.isNew) throw new Error("Posted ledger rows cannot be changed"); });
  for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"])
    schema.pre(operation, function () { throw new Error("Posted ledger rows cannot be changed"); });
}
const party = new Schema({ code: { type: String, required: true }, name: { type: String, required: true },
  kind: { type: String, enum: ["CUSTOMER", "SUPPLIER", "BOTH"], required: true }, email: String,
<<<<<<< HEAD
  phone: String, address: String, gstin: String, paymentTermDays: { type:Number,default:30,min:0,max:365 }, creditLimit: { type:Number,default:null,min:0 },
  qcContact: String, suppliedItems: String, active: { type: Boolean, default: true } }, { timestamps: true });
=======
  phone: String, address: String, gstin: String, active: { type: Boolean, default: true } }, { timestamps: true });
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
scopedUnique(party, "code");
export const ErpParty = createTenantModel("ErpParty", party);
const sku = new Schema({ code: { type: String, required: true }, name: { type: String, required: true },
  unit: { type: String, required: true }, kind: { type: String, enum: ["RAW", "FINISHED", "CONSUMABLE"], required: true },
  location: { type: String, required: true }, batch: String, colour: String, size: String,
  minimumQty: { type: Number, default: 0 }, active: { type: Boolean, default: true } }, { timestamps: true });
scopedUnique(sku, "code"); export const ErpSku = createTenantModel("ErpSku", sku);
const bom = new Schema({ code: { type: String, required: true }, outputSku: { type: String, required: true },
  outputQty: { type: Number, required: true }, components: [{ _id: false, sku: String, qty: Number }],
  active: { type: Boolean, default: true } }, { timestamps: true });
scopedUnique(bom, "code"); export const ErpBom = createTenantModel("ErpBom", bom);
const settings = new Schema({ key: { type: String, default: "ERP" }, enabled: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
  legacyWritesLocked: { type: Boolean, default: false }, activationAt: Date, activatedBy: String,
<<<<<<< HEAD
  migrationNotes: String, approvalThreshold: { type: Number, default: null }, approvalTypes: [String] }, { timestamps: true });
=======
  migrationNotes: String }, { timestamps: true });
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
scopedUnique(settings, "key"); export const ErpSettings = createTenantModel("ErpSettings", settings);
const document = new Schema({ number: { type: String, required: true }, type: { type: String, required: true },
  date: { type: Date, required: true }, partyCode: String, sourceId: String, bomCode: String, notes: String,
  status: { type: String, default: "POSTED", enum: ["POSTED"] }, reversedBy: String,
  idempotencyKey: { type: String, required: true }, requestHash: { type: String, required: true },
  lines: [Schema.Types.Mixed], moves: [Schema.Types.Mixed], journals: [Schema.Types.Mixed],
  totals: Schema.Types.Mixed, metadata: Schema.Types.Mixed, postedBy: String,
  clearedAt: Date, bankReference: String }, { timestamps: true });
scopedUnique(document, "number"); scopedUnique(document, "idempotencyKey");
document.index({ companyId: 1, factoryId: 1, sourceId: 1 });
document.pre("save", function () {
  if (!this.isNew && this.modifiedPaths().some(p => !["reversedBy", "clearedAt", "bankReference", "updatedAt", "updatedBy"].includes(p)))
    throw new Error("Posted document is immutable; reverse it instead");
});
export const ErpDocument = createTenantModel("ErpDocument", document);
const balance = new Schema({ key: { type: String, required: true }, sku: String, location: String,
  qty: { type: Number, default: 0, min: 0 }, value: { type: Number, default: 0, min: 0 } }, { timestamps: true });
scopedUnique(balance, "key"); export const ErpBalance = createTenantModel("ErpBalance", balance);
const entry = new Schema({ documentId: { type: Schema.Types.ObjectId, required: true }, documentNo: String,
  date: Date, kind: { type: String, enum: ["STOCK", "JOURNAL"], required: true },
  key: String, sku: String, location: String, delta: Number, value: Number, qtyAfter: Number, valueAfter: Number,
  unit: String, account: String, debit: Number, credit: Number, party: String }, { timestamps: true });
entry.index({ companyId: 1, factoryId: 1, kind: 1, date: 1 }); immutable(entry);
export const ErpEntry = createTenantModel("ErpEntry", entry);
const sequence = new Schema({ key: { type: String, required: true }, value: { type: Number, default: 0 } });
scopedUnique(sequence, "key"); export const ErpSequence = createTenantModel("ErpSequence", sequence);
export const ERP_MODELS = [ErpParty, ErpSku, ErpBom, ErpSettings, ErpDocument, ErpBalance, ErpEntry, ErpSequence];
<<<<<<< HEAD
const approval = new Schema({ key: { type: String, required: true }, requestHash: String, input: Schema.Types.Mixed,
  requestedBy: String, decidedBy: String, reason: String, documentId: String,
  status: { type: String, enum: ["PENDING","APPROVED","REJECTED","POSTED"], default: "PENDING" } }, { timestamps: true });
scopedUnique(approval,"key");
export const ErpApproval = createTenantModel("ErpApproval",approval);
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
