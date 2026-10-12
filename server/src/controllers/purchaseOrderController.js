import mongoose from "mongoose";
import {authorizeErp} from "../erp/policy.js";
import ApiError from "../utils/ApiError.js";
import { purchaseOrderService } from "../services/purchaseOrderService.js";

export async function getPurchaseOrders(request, response) {
  const pendingOnly = request.query.pending === "true";
  response.json(await purchaseOrderService.getPurchaseOrders(pendingOnly));
}

export async function createPurchaseOrder(request, response) {
  response
    .status(201)
    .json(await purchaseOrderService.createPurchaseOrder(request.body));
}

export async function updatePurchaseOrder(request, response) {
  response.json(
    await purchaseOrderService.updatePurchaseOrder(
      request.params.purchaseOrderId,
      request.body,
    ),
  );
}

export async function closePurchaseOrder(request,response){if(!mongoose.isValidObjectId(request.params.purchaseOrderId))throw new ApiError(400,"Invalid PO ID");if(!authorizeErp(request.user,"post","PURCHASE_ORDER"))throw new ApiError(403,"Purchase permission required for PO closure");response.json(await purchaseOrderService.closePurchaseOrder(request.params.purchaseOrderId,request.body.action,request.body.reason));}

export async function deletePurchaseOrder(request, response) {
  await purchaseOrderService.deletePurchaseOrder(
    request.params.purchaseOrderId,
  );
  response.json({ message: "Purchase order deleted successfully" });
}
