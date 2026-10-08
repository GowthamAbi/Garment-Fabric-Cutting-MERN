import SubscriptionInvoice from "../models/SubscriptionInvoice.js";
import ApiError from "../utils/ApiError.js";
import { queueInvoice } from "../automation/queue.js";

export async function listInvoices(_request, response) {
  response.json(await SubscriptionInvoice.find().sort({ invoiceDate: -1 }).lean());
}

export async function getInvoice(request, response) {
  const invoice = await SubscriptionInvoice.findById(request.params.id).lean();
  if (!invoice) throw new ApiError(404, "Invoice not found");
  response.json(invoice);
}

export async function emailInvoice(request, response) {
  const invoice = await SubscriptionInvoice.findById(request.params.id);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const job = await queueInvoice(invoice);
  if (!job) throw new ApiError(400, "Customer billing email is missing");
  return response.status(202).json({ message: "Invoice email queued; review automation status for delivery", status: job.status });
}
