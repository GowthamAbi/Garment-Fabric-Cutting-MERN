import {poCancellation} from "../utils/companySetupPolicy.js";
import {currentDatabase} from "../config/tenantDatabase.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import {getTenant} from "../utils/tenantContext.js";
import ApiError from "../utils/ApiError.js";
import { purchaseOrderRepository } from "../repositories/purchaseOrderRepository.js";
import Item from "../models/Item.js";

async function syncItemMaster(purchaseOrderData) {
  const itemCode = purchaseOrderData.itemCode.trim().toUpperCase();
  const colour = String(purchaseOrderData.colour || "")
    .trim()
    .toUpperCase();

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
    const fields=["poNo","itemCode","vendorName","brand","description","category","type","colour","unit","indentNo","indentDate","poDate","deliveryDate","orderQty"];purchaseOrderData=Object.fromEntries(fields.filter(k=>purchaseOrderData[k]!==undefined).map(k=>[k,purchaseOrderData[k]]));
    if(!Number.isFinite(Number(purchaseOrderData.orderQty))||Number(purchaseOrderData.orderQty)<=0)throw new ApiError(400,"Positive order quantity required");
    const poNo = String(purchaseOrderData.poNo||"").trim().toUpperCase();
    const itemCode = String(purchaseOrderData.itemCode||"").trim().toUpperCase();if(!poNo||!itemCode)throw new ApiError(400,"PO and item code required");
    await syncItemMaster({ ...purchaseOrderData, poNo, itemCode });

    return purchaseOrderRepository.create({
      ...purchaseOrderData,
      poNo,
      itemCode,
    });
  },

  updatePurchaseOrder: async (purchaseOrderId, purchaseOrderData) => {
    const existing=await PurchaseOrder.findById(purchaseOrderId);if(!existing)throw new ApiError(404,'PO not found');if(['Cancelled','Completed'].includes(existing.status)||existing.archivedAt)throw new ApiError(409,'Closed PO cannot be edited');
    const allowed=['vendorName','brand','description','category','type','indentNo','indentDate','poDate','deliveryDate','orderQty'];
    if(!Number.isFinite(Number(purchaseOrderData.orderQty??existing.orderQty))||Number(purchaseOrderData.orderQty??existing.orderQty)<=0)throw new ApiError(400,'Positive order quantity required');
    if(Number(purchaseOrderData.orderQty??existing.orderQty)<existing.inwardQty)throw new ApiError(409,'Order quantity cannot be below received quantity');
    const purchaseOrder=await PurchaseOrder.findOneAndUpdate({_id:existing._id,status:{$ne:'Cancelled'},archivedAt:{$exists:false},inwardQty:existing.inwardQty},{$set:{...Object.fromEntries(allowed.filter(k=>purchaseOrderData[k]!==undefined).map(k=>[k,purchaseOrderData[k]])),status:existing.inwardQty>=Number(purchaseOrderData.orderQty??existing.orderQty)?'Completed':existing.inwardQty>0?'Part received':'Open'}},{new:true,runValidators:true});if(!purchaseOrder)throw new ApiError(409,'PO changed; refresh before editing');
    await syncItemMaster(purchaseOrder.toObject());
    return purchaseOrder;
  },

  closePurchaseOrder:async(id,action,reason)=>{const session=await currentDatabase().startSession();try{let result;await session.withTransaction(async()=>{const po=await PurchaseOrder.findById(id).session(session);if(!po)throw new ApiError(404,'PO not found');if(action==='CANCEL'){Object.assign(po,poCancellation(po,reason),{cancelledAt:new Date(),cancelledBy:getTenant().userId});}else if(action==='ARCHIVE'){if(!['Completed','Cancelled'].includes(po.status)||!String(reason||'').trim())throw new ApiError(409,'Only completed/cancelled POs can be archived with a reason');if(po.archivedAt)throw new ApiError(409,'PO already archived');po.archivedAt=new Date();po.archivedBy=getTenant().userId;po.archiveReason=String(reason).slice(0,1000);}else throw new ApiError(400,'Use CANCEL or ARCHIVE');await po.save({session});result=po;});return result;}finally{await session.endSession();}},
  deletePurchaseOrder:async()=>{throw new ApiError(409,'PO deletion is disabled. Cancel or archive while preserving receipts.');},
};
