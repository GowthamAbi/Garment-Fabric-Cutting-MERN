import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

// A candidate is deliberately separate from the active tenant registry.
const schema = new mongoose.Schema({
  companyKey: { type: String, required: true, unique: true },
  databaseName: { type: String, required: true },
  atlasHost: { type: String, required: true },
  encryptedUri: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  state: { type: String, enum: ["VALIDATED_PENDING_MIGRATION"], required: true },
  validatedAt: { type: Date, required: true },
  customerConsentReference: { type: String, required: true },
}, { timestamps: true });
const connection = controlDatabase();
export default connection.models.CustomerDatabaseCandidate || connection.model("CustomerDatabaseCandidate", schema);
