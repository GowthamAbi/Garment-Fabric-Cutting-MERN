export function capturedPaymentMatches(entity, billing) {
  return entity?.status === "captured" &&
    entity.currency === "INR" &&
    Number.isSafeInteger(entity.amount) &&
    entity.amount === Math.round(Number(billing.amount) * 100) &&
    entity.order_id === billing.providerOrderId &&
    typeof entity.id === "string" && entity.id.length > 0 &&
    billing.paymentMethod === "RAZORPAY";
}
