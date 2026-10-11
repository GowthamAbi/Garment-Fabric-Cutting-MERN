import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

// A candidate is deliberately separate from the active tenant registry.
const schema = new mongoose.Schema({
  companyKey: { type: String, required: true, unique: true },
  databaseName: { type: String, required: true },
  atlasHost: { type: String, required: true },
  targetFingerprint: { type: String, unique: true, sparse: true },
  encryptedUri: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  state: { type: String, enum: ["VALIDATING", "VALIDATED_PENDING_MIGRATION", "MIGRATING", "ACTIVE", "FAILED"], required: true },
  validatedAt: { type: Date, required: true },
  customerConsentReference: { type: String, required: true },
  requestedBy: String,
  companyId: mongoose.Schema.Types.ObjectId,
  activatedAt: Date,
  migrationSummary: mongoose.Schema.Types.Mixed,
  migrationWorker: mongoose.Schema.Types.Mixed,
  lastError: String,
}, { timestamps: true, platformRegistry: true });
const connection = controlDatabase();
export default connection.models.CustomerDatabaseCandidate || connection.model("CustomerDatabaseCandidate", schema);
