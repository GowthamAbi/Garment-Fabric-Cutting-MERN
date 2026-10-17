// Amounts are integer paise in the ERP, exported in INR for spreadsheet users.
const rs=p=>Number(((Number(p)||0)/100).toFixed(2));
export function shopExportRecords(mode,r={}){
 const {shopSales=[],stockBySku=[],stock=[],incoming=[],receipts=[],invoices=[],
  returns=[],requests=[],transfers=[]}=r;
 if(["sales","margin"].includes(mode))return shopSales.map(x=>({
  Shop:x.shop,Invoices:x.invoices,"Net Sold PCS":x.soldNetPcs,
  "Net Sales INR":rs(x.netSalesPaise),"Gross Sales INR":rs(x.grossSalesPaise),
  "COGS INR":x.cogsComplete?rs(x.cogsPaise):"UNAVAILABLE",
  "Margin INR":x.marginPaise==null?"UNAVAILABLE":rs(x.marginPaise),
  "Live Stock PCS":x.stockPcs
 }));
 if(["invoice","invoices","payment","history","reports"].includes(mode))
  return invoices.map(x=>({
   Invoice:x.number,Shop:x.shop,SKU:x.sku,"Date":x.createdAt||"",
   "Sold PCS":x.quantity,"Returned PCS":x.returnedPcs,"Net Sold PCS":x.soldNetPcs,
   "Invoice Gross INR":rs(x.invoiceGrossPaise),"Refunds INR":rs(x.refundPaise),
   "Net Collected INR":rs(x.grossPaise),"Payment Mode":x.paymentMode,
   "Margin INR":x.marginPaise==null?"UNAVAILABLE":rs(x.marginPaise),
   "Document":x.documentId
  }));
 if(["requests","return"].includes(mode))return requests.map(x=>({
  Invoice:x.invoice,Shop:x.shop,SKU:x.sku,PCS:x.quantity,
  Reason:x.reason,Category:x.kind,Status:x.status,Date:x.createdAt||""
 }));
 if(["transfer","transfers"].includes(mode))return transfers.map(x=>({
  "Date":x.date||"",Destination:x.destination,"New Stage":x.nextStage,
  Carton:x.bundleNo,"PCS":x.quantity,"ERP Document":x.documentId
 }));
 if(["receipts","receipt"].includes(mode))return receipts.map(x=>({
  "Date":x.date||"",Shop:x.shop,Carton:x.bundleNo,
  "Sent PCS":x.sentPcs,"Received PCS":x.receivedPcs,
  "Pending PCS":x.pendingPcs,Status:x.status,Document:x.documentId
 }));
 if(["stock","issues"].includes(mode))return stockBySku.map(x=>({
  Shop:x.shop,SKU:x.sku,Size:x.size,Colour:x.colour,
  "Available PCS":x.quantity,Bundles:x.bundles
 }));
 if(["pos","outward","count","ledger"].includes(mode))return stock.map(x=>({
  Shop:x.shop,Carton:x.bundleNo,SKU:x.sku,Size:x.size,Colour:x.colour,
  Stage:x.stage,PCS:x.quantity
 }));
 return incoming.map(x=>({Shop:x.shop,Carton:x.bundleNo,SKU:x.sku,
  Size:x.size,Colour:x.colour,PCS:x.quantity,Stage:x.stage}));
}
