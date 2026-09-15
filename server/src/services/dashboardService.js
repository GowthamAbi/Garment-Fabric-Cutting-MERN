import Item from "../models/Item.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Transaction from "../models/Transaction.js";

export async function getDashboardSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tenDaysFromNow = new Date();
  tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

  const [items, duePurchaseOrders, todayTransactions] = await Promise.all([
    Item.find(),
    PurchaseOrder.find({
      deliveryDate: { $gte: new Date(), $lte: tenDaysFromNow },
      status: { $ne: "Completed" },
    }).sort({ deliveryDate: 1 }),
    Transaction.find({ transactionDate: { $gte: today } }),
  ]);

  return {
    totalItems: items.length,
    lowStock: items.filter((item) => item.stockQty < item.minimumQty),
    duePOs: duePurchaseOrders,
    todayInward: totalByType(todayTransactions, "INWARD"),
    todayOutward: totalByType(todayTransactions, "OUTWARD"),
  };
}

function totalByType(transactions, transactionType) {
  return transactions
    .filter((transaction) => transaction.kind === transactionType)
    .reduce((total, transaction) => total + transaction.quantity, 0);
}
