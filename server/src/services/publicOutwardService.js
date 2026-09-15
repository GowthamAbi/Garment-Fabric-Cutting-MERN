import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import Inward from "../models/Inward.js";
import Item from "../models/Item.js";
import Outward from "../models/Outward.js";
import Transaction from "../models/Transaction.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

export async function getInwardForQR(inwardNo) {
  const inward = await Inward.findOne({ inwardNo }).lean();
  if (!inward) throw new ApiError(404, "Inward number not found");

  const item = await Item.findOne({ itemCode: inward.itemCode }).lean();
  if (!item) throw new ApiError(404, "Item details not found");

  return {
    inwardNo: inward.inwardNo,
    itemCode: inward.itemCode,
    description: inward.description || item.description,
    brand: inward.brand || item.brand,
    type: inward.type || item.type,
    colour: inward.colour || item.colour,
    unit: inward.unit || item.unit,
    inwardQty: inward.quantity,
    availableQty: inward.balanceQty,
    inwardDate: inward.inwardDate,
  };
}

export async function issueFromExactInward(data) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const inward = await Inward.findOne({ inwardNo: data.inwardNo }).session(
        session,
      );
      if (!inward) throw new ApiError(404, "Inward number not found");

      const item = await Item.findOne({ itemCode: inward.itemCode }).session(
        session,
      );
      if (!item) throw new ApiError(404, "Item details not found");

      const wantedQty = Number(data.wantedQty);
      if (!Number.isFinite(wantedQty) || wantedQty <= 0) {
        throw new ApiError(400, "Wanted Mtr must be greater than zero");
      }
      if (wantedQty > inward.balanceQty) {
        throw new ApiError(
          400,
          `Only ${inward.balanceQty} ${item.unit} available in this inward`,
        );
      }
      if (wantedQty > item.stockQty) {
        throw new ApiError(
          409,
          "Item stock balance is inconsistent; contact the store admin",
        );
      }
      if (!data.dcNo?.trim() || !data.section?.trim()) {
        throw new ApiError(400, "DC No and section are required");
      }
      if (!data.itemName?.trim()) throw new ApiError(400, "Item Name / usage is required");

      inward.balanceQty -= wantedQty;
      item.stockQty -= wantedQty;
      await inward.save({ session });
      await item.save({ session });

      const outwardNo = generateReferenceNo("OUT");
      await Outward.create(
        [
          {
            outwardNo,
            inwardNo: inward.inwardNo,
            companyId: inward.companyId,
            factoryId: inward.factoryId,
            itemCode: inward.itemCode,
            itemName: data.itemName.trim(),
            colour: inward.colour || item.colour || "",
            dcNo: data.dcNo.trim(),
            section: data.section.trim(),
            quantity: wantedQty,
          },
        ],
        { session },
      );
      await Transaction.create(
        [
          {
            referenceNo: outwardNo,
            kind: "OUTWARD",
            inwardReference: inward.inwardNo,
            companyId: inward.companyId,
            factoryId: inward.factoryId,
            itemCode: inward.itemCode,
            itemName: data.itemName.trim(),
            colour: inward.colour || item.colour || "",
            dcNo: data.dcNo.trim(),
            section: data.section.trim(),
            quantity: wantedQty,
            balanceQty: inward.balanceQty,
            createdBy: "QR User",
          },
        ],
        { session },
      );

      result = {
        referenceNo: outwardNo,
        kind: "OUTWARD",
        outwardNo,
        inwardNo: inward.inwardNo,
        inwardReference: inward.inwardNo,
        itemCode: inward.itemCode,
        itemName: data.itemName.trim(),
        description: inward.description || item.description,
        brand: inward.brand || item.brand,
        type: inward.type || item.type,
        colour: inward.colour || item.colour,
        dcNo: data.dcNo.trim(),
        section: data.section.trim(),
        quantity: wantedQty,
        issuedQty: wantedQty,
        availableQty: inward.balanceQty,
        balanceQty: inward.balanceQty,
        unit: inward.unit || item.unit,
        transactionDate: new Date(),
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}
