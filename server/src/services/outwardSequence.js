import SequenceCounter from "../models/SequenceCounter.js";

export async function getNextFabricOutwardNo({ companyId, factoryId, updatedBy }) {
  const counter = await SequenceCounter.findOneAndUpdate(
    { companyId, factoryId, sequenceName: "FABRIC_OUTWARD" },
    {
      $inc: { currentValue: 1 },
      $setOnInsert: { companyId, factoryId, sequenceName: "FABRIC_OUTWARD" },
      $set: { updatedBy },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return counter.currentValue;
}
