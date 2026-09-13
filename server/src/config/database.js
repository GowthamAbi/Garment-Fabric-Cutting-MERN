import mongoose from "mongoose";

export async function connectDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);
  // Remove only the two legacy unique indexes superseded by revision/month keys.
  for (const [collectionName, indexName] of [
    ["garmentboms", "companyId_1_factoryId_1_bomNo_1"],
    ["garmentpurchaseorders", "companyId_1_factoryId_1_poNo_1_itemCode_1_style_1_colour_1"],
  ]) {
    const collection = mongoose.connection.db.collection(collectionName);
    const indexes = await collection.indexes().catch(() => []);
    if (indexes.some((index) => index.name === indexName)) await collection.dropIndex(indexName);
  }
  console.log("MongoDB connected");
}
