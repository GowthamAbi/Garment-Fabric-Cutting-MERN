export function positiveStockQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0.001) throw new Error("Stock quantity must be a positive finite number of at least 0.001");
  return quantity;
}
