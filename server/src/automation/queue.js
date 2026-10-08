import { EmailOutbox } from "./models.js";
import { getTenant } from "../utils/tenantContext.js";
export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function queueInvoice(invoice, session = null) {
  if (!invoice.customer?.email) return null;
  const tenant = getTenant();
  const dedupeKey = `invoice-${tenant.companyKey}-${invoice._id}`;
  return EmailOutbox.findOneAndUpdate({ dedupeKey }, { $setOnInsert: {
    dedupeKey, companyKey: tenant.companyKey, databaseName: tenant.databaseName,
    companyId: invoice.companyId, factoryId: invoice.factoryId, invoiceId: String(invoice._id),
    payload: { to: [invoice.customer.email], subject: `UG SaaS Invoice ${invoice.invoiceNumber}`,
      html: `<h2>Subscription invoice</h2><p>Invoice: ${escapeHtml(invoice.invoiceNumber)}</p><p>Total: INR ${Number(invoice.grandTotal).toFixed(2)}</p><p>Login to your company workspace to download the invoice.</p>` },
    status: "PENDING", nextAttemptAt: new Date(), attempts: 0,
  } }, { upsert: true, new: true, session });
}
export function retryDate(attempt, now = Date.now()) { return new Date(now + Math.min(3600000, 15000 * 2 ** Math.min(attempt, 8))); }
