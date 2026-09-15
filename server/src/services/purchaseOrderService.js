import ApiError from "../utils/ApiError.js";
import { purchaseOrderRepository } from "../repositories/purchaseOrderRepository.js";
import Item from "../models/Item.js";

async function syncItemMaster(purchaseOrderData) {
  const itemCode = purchaseOrderData.itemCode.trim().toUpperCase();
  const colour = String(purchaseOrderData.colour || "").trim().toUpperCase();

  return Item.findOneAndUpdate(
    { itemCode, colour },
    {
      $set: {
        brand: purchaseOrderData.brand || "",
        description: purchaseOrderData.description || itemCode,
        category: purchaseOrderData.category || "Uncategorized",
        type: purchaseOrderData.type || "",
        unit: purchaseOrderData.unit || "MTR",
        sourcePoNo: purchaseOrderData.poNo || "",
        sourceIndentNo: purchaseOrderData.indentNo || "",
      },
      $setOnInsert: { itemCode, colour, stockQty: 0 },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export const purchaseOrderService = {
  getPurchaseOrders: (pendingOnly) => {
    const filter = pendingOnly
      ? { status: { $in: ["Open", "Part received"] } }
      : {};

    return purchaseOrderRepository.findAll(filter);
  },

  createPurchaseOrder: async (purchaseOrderData) => {
    const poNo = purchaseOrderData.poNo.trim().toUpperCase();
    const itemCode = purchaseOrderData.itemCode.trim().toUpperCase();
    await syncItemMaster({ ...purchaseOrderData, poNo, itemCode });

    return purchaseOrderRepository.create({ ...purchaseOrderData, poNo, itemCode });
  },

  updatePurchaseOrder: async (purchaseOrderId, purchaseOrderData) => {
    const purchaseOrder = await purchaseOrderRepository.update(
      purchaseOrderId,
      purchaseOrderData,
    );

    if (!purchaseOrder) throw new ApiError(404, "Purchase order not found");
    await syncItemMaster(purchaseOrder.toObject());
    return purchaseOrder;
  },

  deletePurchaseOrder: async (purchaseOrderId) => {
    const purchaseOrder = await purchaseOrderRepository.remove(purchaseOrderId);
    if (!purchaseOrder) throw new ApiError(404, "Purchase order not found");
  },
};
