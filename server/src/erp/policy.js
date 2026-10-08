export const LOCATIONS = ["FABRIC", "CUTTING", "ELASTIC", "ACCESSORIES", "STITCHING", "FINISHING", "PACKING", "WIP", "QC", "FINISHED", "REJECTED", "JOBWORK", "DELIVERY"];
export const TYPES = ["QUOTATION", "PURCHASE_ORDER", "SALES_ORDER", "WORK_ORDER", "OPENING", "GOODS_RECEIPT", "PURCHASE_INVOICE", "PURCHASE_RETURN", "SALES_INVOICE", "DISPATCH", "SALES_RETURN", "STOCK_TRANSFER", "MATERIAL_ISSUE", "MATERIAL_RETURN", "WORK_COST", "PRODUCTION_RECEIPT", "QC_RELEASE", "QC_REJECT", "WASTE", "JOBWORK_SEND", "JOBWORK_RECEIPT", "RECEIPT", "PAYMENT", "JOURNAL"];
export const ACCOUNTS = {
  INVENTORY: { name: "Inventory", group: "ASSET" }, WIP: { name: "Work in progress", group: "ASSET" },
  BANK: { name: "Bank", group: "ASSET" }, CASH: { name: "Cash", group: "ASSET" },
  AR: { name: "Accounts receivable", group: "ASSET" }, INPUT_TAX: { name: "Input tax", group: "ASSET" },
  AP: { name: "Accounts payable", group: "LIABILITY" }, GRNI: { name: "Goods received not invoiced", group: "LIABILITY" },
  OUTPUT_TAX: { name: "Output tax", group: "LIABILITY" }, OPENING_EQUITY: { name: "Opening equity", group: "EQUITY" },
  SALES: { name: "Sales", group: "REVENUE" }, COGS: { name: "Cost of goods sold", group: "EXPENSE" },
  WASTE_EXPENSE: { name: "Waste expense", group: "EXPENSE" }, OPERATING_EXPENSE: { name: "Operating expense", group: "EXPENSE" },
};
export function fail(message) { const error = new Error(message); error.statusCode = 409; throw error; }
export function scaled(value, scale, label, positive = false) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") fail(`${label} is required`);
  const n = Number(value), result = Math.round(n * scale);
  if (!Number.isFinite(n) || !Number.isSafeInteger(result) || result < 0 || Math.abs(n * scale - result) > 0.000001 || (positive && result <= 0))
    fail(`${label} must be non-negative with no more than ${Math.log10(scale)} decimals`);
  return result;
}
export const quantity = (v) => scaled(v, 1000, "Quantity", true);
export const money = (v) => scaled(v, 100, "Amount");
export function safeInteger(n) { if (!Number.isSafeInteger(n) || n < 0) fail("Numeric overflow or negative balance"); return n; }
export function ratio(a, b, divisor) {
  if (![a, b, divisor].every(Number.isSafeInteger) || a < 0 || b < 0 || divisor <= 0) fail("Invalid calculation");
  return safeInteger(Number((BigInt(a) * BigInt(b) + BigInt(divisor) / 2n) / BigInt(divisor)));
}
export function ceilingRatio(a, b, divisor) {
  if (![a, b, divisor].every(Number.isSafeInteger) || a < 0 || b < 0 || divisor <= 0) fail("Invalid calculation");
  return safeInteger(Number((BigInt(a) * BigInt(b) + BigInt(divisor) - 1n) / BigInt(divisor)));
}
export function stockKey(sku, location) { if (!LOCATIONS.includes(location) && !/^WIP:[a-f0-9]{24}$/.test(location)) fail("Invalid stock location"); return `${sku}@${location}`; }
export function authorizeErp(user, action, type = "") {
  if (["saas_super_admin", "support_viewer"].includes(user?.role)) return false;
  if (["company_admin", "admin"].includes(user?.role)) return true;
  if (action === "read") return ["management", "view_only"].includes(user?.role) || (user?.permissions || []).some(p => p.startsWith("erp."));
  if (action === "finance") return user?.role === "management" || (user?.permissions || []).includes("erp.accounts") || (user?.permissions || []).includes("erp.finance.read");
  const area = ["QC_RELEASE", "QC_REJECT"].includes(type) ? "quality" :
    ["JOURNAL", "RECEIPT", "PAYMENT", "WORK_COST"].includes(type) ? "accounts" :
    ["QUOTATION", "SALES_ORDER", "SALES_INVOICE", "DISPATCH", "SALES_RETURN"].includes(type) ? "sales" :
    ["PURCHASE_ORDER", "GOODS_RECEIPT", "PURCHASE_INVOICE", "PURCHASE_RETURN"].includes(type) ? "purchase" : "stock";
  return (user?.permissions || []).includes(`erp.${action === "post" ? area : action}`);
}
