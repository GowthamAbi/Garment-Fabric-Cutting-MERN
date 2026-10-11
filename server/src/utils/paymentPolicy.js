export function capturedPaymentMatches(entity, billing) {
  return entity?.status === "captured" &&
    entity.currency === "INR" &&
    Number.isSafeInteger(entity.amount) &&
    entity.amount === Math.round(Number(billing.amount) * 100) &&
    entity.order_id === billing.providerOrderId &&
    typeof entity.id === "string" && entity.id.length > 0 &&
    billing.paymentMethod === "RAZORPAY";
}

export function providerOrderMatches(order,amount){return typeof order?.id==='string'&&/^order_[A-Za-z0-9]+$/.test(order.id)&&order.currency==='INR'&&Number.isSafeInteger(order.amount)&&order.amount===Math.round(amount*100);}
export function validBillingSnapshot(billing){const e=billing?.entitlements;return Number.isSafeInteger(billing?.validityDays)&&billing.validityDays>=1&&billing.validityDays<=3660&&Number.isSafeInteger(e?.maxUsers)&&e.maxUsers>0&&Number.isSafeInteger(e?.maxDepartments)&&e.maxDepartments>0&&Array.isArray(e?.modules)&&e.modules.every(m=>typeof m==='string');}
