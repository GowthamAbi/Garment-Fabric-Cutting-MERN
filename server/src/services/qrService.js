export const createQRPayload = (inward) =>
  JSON.stringify({
    inwardNo: inward.referenceNo,
    itemCode: inward.itemCode,
    quantity: inward.quantity,
  });
