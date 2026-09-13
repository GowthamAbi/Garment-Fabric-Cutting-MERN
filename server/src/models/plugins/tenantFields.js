import mongoose from "mongoose";

export function tenantFields(schema) {
  schema.add({
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    factoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    updatedBy: {
      type: String,
      default: "System",
      trim: true,
    },
  });
}
