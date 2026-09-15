export function createQRValue(inward) {
  return JSON.stringify({
    referenceNo: inward.referenceNo,
    itemCode: inward.itemCode,
    quantity: inward.quantity,
  });
}
