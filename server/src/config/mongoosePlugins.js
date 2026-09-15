import mongoose from "mongoose";
import { getTenant } from "../utils/tenantContext.js";

const scopedOperations = [
  "countDocuments", "deleteMany", "deleteOne", "find", "findOne",
  "findOneAndDelete", "findOneAndUpdate", "updateMany", "updateOne",
];

function tenantPlugin(schema) {
  schema.add({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    factoryId: { type: mongoose.Schema.Types.ObjectId, index: true },
    updatedBy: { type: String, default: "System" },
  });

  for (const operation of scopedOperations) {
    schema.pre(operation, function scopeTenant() {
      if (this.model.modelName === "Company") return;
      const tenant = getTenant();
      if (tenant.companyId && tenant.role !== "saas_super_admin") this.where({ companyId: tenant.companyId });
      if (tenant.factoryId && tenant.role !== "saas_super_admin") this.where({ factoryId: tenant.factoryId });
    });
  }

  schema.pre("aggregate", function scopeAggregation() {
    if (this.model()?.modelName === "Company") return;
    const tenant = getTenant();
    if (tenant.companyId && tenant.role !== "saas_super_admin") {
      this.pipeline().unshift({ $match: { companyId: new mongoose.Types.ObjectId(tenant.companyId) } });
    }
  });

  schema.pre("save", function addTenantAudit(next) {
    if (this.constructor.modelName === "Company") return next();
    const tenant = getTenant();
    if (!this.companyId && tenant.companyId) this.companyId = tenant.companyId;
    if (!this.factoryId && tenant.factoryId) this.factoryId = tenant.factoryId;
    if (tenant.name) this.updatedBy = tenant.name;
    next();
  });
}

mongoose.plugin(tenantPlugin);
