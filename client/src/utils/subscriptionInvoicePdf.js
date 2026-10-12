import {jsPDF} from "jspdf";
export function downloadInvoice(invoice) {
  const doc = new jsPDF();
  const item = invoice.lineItems?.[0] || {};
  doc.setFontSize(18);
  doc.text(invoice.taxType==="NO_TAX"?"UG SaaS - INVOICE":"UG SaaS - TAX INVOICE", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 15, 32);
  doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, 15, 39);
  doc.text(`Supplier: ${invoice.supplier?.legalName || "UG SaaS"}`, 15, 52);
  doc.text(`GSTIN: ${invoice.supplier?.gstin || "Not configured"}`, 15, 59);
  doc.text(`Bill To: ${invoice.customer?.companyName || "Customer"}`, 15, 72);
  doc.text(`Customer GSTIN: ${invoice.customer?.gstin || "Not provided"}`, 15, 79);
  doc.line(15, 88, 195, 88);
  doc.text("Description", 15, 97);
  doc.text("Taxable", 125, 97);
  doc.text("Total", 170, 97);
  doc.text(item.description || "SaaS Subscription", 15, 108);
  doc.text(`INR ${Number(invoice.subtotal || 0).toFixed(2)}`, 125, 108);
  doc.text(`INR ${Number(invoice.grandTotal || 0).toFixed(2)}`, 170, 108);
  doc.line(15, 116, 195, 116);
  doc.text(`CGST: INR ${Number(invoice.cgstAmount || 0).toFixed(2)}`, 125, 128);
  doc.text(`SGST: INR ${Number(invoice.sgstAmount || 0).toFixed(2)}`, 125, 135);
  doc.text(`IGST: INR ${Number(invoice.igstAmount || 0).toFixed(2)}`, 125, 142);
  doc.setFontSize(12);
  doc.text(`Grand Total: INR ${Number(invoice.grandTotal || 0).toFixed(2)}`, 125, 154);
  doc.setFontSize(9);
  doc.text("Computer-generated invoice. Tax configuration must be verified by the business accountant.", 15, 180);
  doc.save(`${invoice.invoiceNumber.replaceAll("/", "-")}.pdf`);
}

