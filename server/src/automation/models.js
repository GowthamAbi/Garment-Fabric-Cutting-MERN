import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";
const { Schema } = mongoose, connection = controlDatabase();
const central = (name, schema) => connection.models[name] || connection.model(name, schema);
const outbox = new Schema({ dedupeKey: { type: String, required: true, unique: true }, companyKey: String,
  databaseName: String, payload: Schema.Types.Mixed, invoiceId: String,
  status: { type: String, enum: ["PENDING", "PROCESSING", "SENT", "DEAD"], default: "PENDING" },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now }, leaseUntil: Date,
  leaseToken: String, firstAttemptAt: Date, providerId: String, sentAt: Date, lastError: String }, { timestamps: true });
outbox.index({ status: 1, nextAttemptAt: 1 }); export const EmailOutbox = central("EmailOutbox", outbox);
const webhook = new Schema({ key: { type: String, required: true, unique: true }, billingId: String,
  entity: Schema.Types.Mixed, status: { type: String, enum: ["PENDING", "PROCESSING", "DONE", "DEAD"], default: "PENDING" },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date, leaseToken: String, lastError: String }, { timestamps: true });
webhook.index({ status: 1, nextAttemptAt: 1 }); export const PaymentInbox = central("PaymentInbox", webhook);
const request = new Schema({ key: { type: String, required: true, unique: true }, companyKey: { type: String, required: true },
  databaseName: String, kind: { type: String, enum: ["CANCEL", "REFUND"], required: true }, billingId: String,
  amount: Number, reason: String, requestedBy: String, approvedBy: String,
  termEndsAt: Date,
  status: { type: String, enum: ["REQUESTED", "APPROVED", "REJECTED", "PROCESSING", "COMPLETED", "FAILED"], default: "REQUESTED" },
  providerId: String, manualReference: String, lastError: String, attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now }, leaseUntil: Date, leaseToken: String,
  processedAt: Date }, { timestamps: true });
export const SubscriptionAction = central("SubscriptionAction", request);
