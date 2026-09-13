import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const fabricMasterSchema = new mongoose.Schema(
  {
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    fabricType: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    dia: { type: String, default: "", uppercase: true, trim: true },
    gsm: { type: Number, default: 0, min: 0 },
    unit: { type: String, enum: ["KG"], default: "KG" },
    active: { type: Boolean, default: true },
    customFields: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

tenantFields(fabricMasterSchema);
fabricMasterSchema.index(
  { companyId: 1, factoryId: 1, fabricCode: 1, colour: 1, dia: 1, gsm: 1 },
  { unique: true },
);

export default mongoose.model("FabricMaster", fabricMasterSchema);
