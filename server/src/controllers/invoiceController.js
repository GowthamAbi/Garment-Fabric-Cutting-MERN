import SubscriptionInvoice from "../models/SubscriptionInvoice.js";
import ApiError from "../utils/ApiError.js";

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
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new ApiError(503, "Invoice email provider is not configured");
  const destination = invoice.customer?.email;
  if (!destination) throw new ApiError(400, "Customer billing email is missing");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [destination],
      subject: `UG SaaS Invoice ${invoice.invoiceNumber}`,
      html: `<h2>UG SaaS Subscription Invoice</h2><p>Invoice: <b>${invoice.invoiceNumber}</b></p><p>Plan: ${invoice.lineItems?.[0]?.description || "Subscription"}</p><p>Total: INR ${invoice.grandTotal.toFixed(2)}</p><p>Login to your company workspace to download the invoice.</p>`,
    }),
  });
  if (!result.ok) throw new ApiError(502, "Invoice email could not be sent");
  invoice.emailedAt = new Date();
  await invoice.save();
  response.json({ message: "Invoice emailed successfully", emailedAt: invoice.emailedAt });
}

