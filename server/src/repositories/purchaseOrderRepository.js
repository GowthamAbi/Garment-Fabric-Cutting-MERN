import PurchaseOrder from "../models/PurchaseOrder.js";

export const purchaseOrderRepository = {
  findAll: (filter = {}) =>
    PurchaseOrder.find(filter).sort({ deliveryDate: 1 }),

  findByNumberAndItem: (poNo, itemCode, session = null) =>
    PurchaseOrder.findOne({
      poNo: poNo.trim().toUpperCase(),
      itemCode: itemCode.trim().toUpperCase(),
    }).session(session),

  create: (purchaseOrderData) => PurchaseOrder.create(purchaseOrderData),

  update: (purchaseOrderId, purchaseOrderData) =>
    PurchaseOrder.findByIdAndUpdate(purchaseOrderId, purchaseOrderData, {
      new: true,
      runValidators: true,
    }),

  remove: (purchaseOrderId) => PurchaseOrder.findByIdAndDelete(purchaseOrderId),
};
