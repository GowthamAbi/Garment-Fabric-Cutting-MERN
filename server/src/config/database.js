import mongoose from "mongoose";
import PurchaseOrder from "../models/PurchaseOrder.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import FabricMaster from "../models/FabricMaster.js";

/** Connect the application to MongoDB Atlas. */
export async function connectDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Older releases created a unique PO-number-only index. Remove only that
  // legacy index so a PO can safely contain multiple item-code lines.
  const indexes = await PurchaseOrder.collection.indexes();
  const oldPoIndex = indexes.find(
    (index) =>
      index.unique && JSON.stringify(index.key) === JSON.stringify({ poNo: 1 }),
  );
  if (oldPoIndex) await PurchaseOrder.collection.dropIndex(oldPoIndex.name);
  await PurchaseOrder.syncIndexes();

  // Fabric Master no longer uses Item Code/Name. Rebuild only its indexes and
  // preserve older rows by deriving a readable Fabric Name from the group.
  await FabricMaster.collection.updateMany(
    { $or: [{ fabricName: { $exists: false } }, { fabricName: "" }] },
    [{ $set: { fabricName: { $ifNull: ["$fabricGroup", "$fabricCode"] } } }],
  );
  await FabricMaster.syncIndexes();

  // Safe migration for existing single-company installations. Old records are
  // attached to a default company/factory before tenant scoping is used.
  let defaultCompany = await Company.findOne();
  if (!defaultCompany) {
    defaultCompany = await Company.create({
      companyName: "UG SaaS",
      factories: [{ name: "Main Factory", code: "MAIN" }],
    });
  }
  const defaultFactoryId = defaultCompany.factories[0]?._id;
  const excluded = new Set(["companies", "system.version"]);
  for (const collection of await mongoose.connection.db
    .listCollections()
    .toArray()) {
    if (excluded.has(collection.name)) continue;
    await mongoose.connection.db.collection(collection.name).updateMany(
      { companyId: { $exists: false } },
      {
        $set: {
          companyId: defaultCompany._id,
          ...(defaultFactoryId && { factoryId: defaultFactoryId }),
          updatedBy: "SaaS migration",
        },
      },
    );
  }

  // Upgrade an existing Store-only installation: preserve the oldest account
  // and make it the single administrator when no admin exists yet.
  if (!(await User.exists({ role: "admin" }))) {
    const oldestUser = await User.findOne().sort({ createdAt: 1 });
    if (oldestUser) {
      oldestUser.role = "admin";
      await oldestUser.save();
    }
  }
  console.log("MongoDB connected successfully");
}
