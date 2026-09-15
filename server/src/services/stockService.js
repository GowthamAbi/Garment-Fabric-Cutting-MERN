import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import { itemRepository } from "../repositories/itemRepository.js";
import { purchaseOrderRepository } from "../repositories/purchaseOrderRepository.js";
import { transactionRepository } from "../repositories/transactionRepository.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";
import Inward from "../models/Inward.js";
import Item from "../models/Item.js";

export async function createInward(inwardData) {
  const session = await mongoose.startSession();
  let savedTransaction;

  try {
    await session.withTransaction(async () => {
      let purchaseOrder = null;

      if (inwardData.poNo && inwardData.itemCode) {
        purchaseOrder = await purchaseOrderRepository.findByNumberAndItem(
          inwardData.poNo,
          inwardData.itemCode,
          session,
        );

        if (!purchaseOrder) {
          throw new ApiError(404, "PO No. and Item Code combination not found");
        }
      }

      if (!purchaseOrder) {
        throw new ApiError(400, "PO No. and Item Code are required for inward");
      }

      let item = await itemRepository.findByCode(inwardData.itemCode, session);

      if (!item && purchaseOrder) {
        const createdItems = await Item.create(
          [
            {
              itemCode: purchaseOrder.itemCode,
              brand: purchaseOrder.brand || "",
              description: purchaseOrder.description || purchaseOrder.itemCode,
              category: purchaseOrder.category || "Uncategorized",
              type: purchaseOrder.type || "",
              colour: purchaseOrder.colour || "",
              unit: purchaseOrder.unit || "MTR",
            },
          ],
          { session },
        );
        item = createdItems[0];
      }

      if (!item) {
        throw new ApiError(404, "Item code not found in PO or Item Master");
      }

      item.stockQty += Number(inwardData.quantity);
      await item.save({ session });

      if (purchaseOrder) {
        const pendingQty = purchaseOrder.orderQty - purchaseOrder.inwardQty;
        if (Number(inwardData.quantity) > pendingQty) {
          throw new ApiError(400, `Only ${pendingQty} quantity pending in this PO item`);
        }
        purchaseOrder.inwardQty += Number(inwardData.quantity);
        purchaseOrder.status =
          purchaseOrder.inwardQty >= purchaseOrder.orderQty
            ? ORDER_STATUS.COMPLETED
            : ORDER_STATUS.PART_RECEIVED;

        await purchaseOrder.save({ session });
      }

      const inwardNumber = generateReferenceNo("INW");

      const transaction = await transactionRepository.create(
        {
          ...inwardData,
          indentNo: purchaseOrder.indentNo || "",
          referenceNo: inwardNumber,
          kind: "INWARD",
          balanceQty: item.stockQty,
        },
        session,
      );

      await Inward.create(
        [
          {
            inwardNo: inwardNumber,
            itemCode: item.itemCode,
            brand: item.brand || "",
            description: item.description || item.itemCode,
            type: item.type || "",
            colour: item.colour || "",
            unit: item.unit || "MTR",
            poNo: inwardData.poNo,
            indentNo: purchaseOrder.indentNo || "",
            quantity: Number(inwardData.quantity),
            balanceQty: Number(inwardData.quantity),
            inwardDate: inwardData.transactionDate,
          },
        ],
        { session },
      );

      savedTransaction = {
        ...transaction.toObject(),
        unit: item.unit,
      };
    });

    return savedTransaction;
  } finally {
    await session.endSession();
  }
}

export async function createOutward(outwardData) {
  const session = await mongoose.startSession();
  let savedTransaction;

  try {
    await session.withTransaction(async () => {
      const item = await itemRepository.findByCode(
        outwardData.itemCode,
        session,
      );
      if (!item) throw new ApiError(404, "Item code not found");

      const outwardQuantity = Number(outwardData.quantity);
      if (item.stockQty < outwardQuantity) {
        throw new ApiError(400, `Only ${item.stockQty} ${item.unit} available`);
      }

      item.stockQty -= outwardQuantity;
      await item.save({ session });

      savedTransaction = await transactionRepository.create(
        {
          ...outwardData,
          referenceNo: generateReferenceNo("OUT"),
          kind: "OUTWARD",
          balanceQty: item.stockQty,
        },
        session,
      );
    });

    return savedTransaction;
  } finally {
    await session.endSession();
  }
}
