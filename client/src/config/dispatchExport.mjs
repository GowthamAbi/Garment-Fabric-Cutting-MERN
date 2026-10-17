export function dispatchExportRecords(mode,lists={}){
 const {bundles=[],orders=[],history=[],schedules=[],exceptions=[]}=lists;
 if(["schedule","plan"].includes(mode))return schedules.map(x=>({
  "UTC Date":x.date,SKU:x.sku,"DC":x.dcNo,"Warehouse":x.destination,
  "Scheduled PCS":x.plannedPcs,"Dispatched PCS":x.actualPcs,"Pending PCS":x.pendingPcs,
  "Achievement %":x.achievementPercent,Notes:x.notes}));
 if(["exception","delays"].includes(mode)&&mode==="exception")return exceptions.map(x=>({
  "Date":x.createdAt||"",Carton:x.cartonNo,DC:x.dcNo,Stage:x.stage,
  Category:x.category,"PCS":x.quantity,Status:x.status,Reason:x.reason}));
 if(["history","transit","challen","transport","reports","loading"].includes(mode))
  return history.map(h=>({"Date":h.date||"",DC:h.dcNo,Order:h.orderNo,
   Carton:h.cartonNo,SKU:h.sku,"Warehouse":h.destination,
   "Shipped PCS":h.shippedPcs,"Warehouse Receipt PCS":h.receivedPcs,
   "Receipt Pending PCS":h.pendingReceiptPcs,Status:h.status,
   Vehicle:h.transport?.vehicleNo||"",Transporter:h.transport?.transporter||"",
   "LR / Docket":h.transport?.lrNo||"","ERP Document":h.documentId}));
 if(["ready","packed","entry","destination"].includes(mode))
  return bundles.map(b=>({Carton:b.cartonNo,DC:b.dcNo,Order:b.orderNo,
   SKU:b.sku,Colour:b.colour,Size:b.size,Section:b.section,
   Stage:b.stage,"Available PCS":b.quantity,Warehouse:b.destination}));
 return orders.map(o=>({Order:o.orderNo,DC:o.dcNo,SKU:o.sku,
  "Ready PCS":o.readyPackedPcs,"In Transit PCS":o.inTransitPcs,Cartons:o.cartons}));
}
