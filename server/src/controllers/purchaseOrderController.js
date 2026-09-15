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

export async function deletePurchaseOrder(request, response) {
  await purchaseOrderService.deletePurchaseOrder(
    request.params.purchaseOrderId,
  );
  response.json({ message: "Purchase order deleted successfully" });
}
