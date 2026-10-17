export function warehouseExportRecords(mode,r={}){
 const {locations=[],bins=[],bundles=[],stocks=[],inbound=[],history=[],requests=[]}=r;
 if(mode==="master")return locations.map(x=>({"Warehouse Key":x.key,Name:x.name,Address:x.address}));
 if(mode==="putaway")return bins.map(x=>({"Warehouse":x.warehouse,Bin:x.key,Rack:x.rack,"Bin Label":x.bin}));
 if(["count","variance","adjustment"].includes(mode))return requests.map(x=>({
  Warehouse:x.warehouse,Stage:x.stage,"Expected PCS":x.expectedPcs,
  "Counted PCS":x.countedPcs,"Variance PCS":x.differencePcs,
  Reason:x.reason,Status:x.status,"Approval Document":x.documentId
 }));
 if(["receipts","inbound","returns"].includes(mode))return inbound.map(x=>({
  "Origin":x.origin,DC:x.dcNo,Carton:x.cartonNo,Warehouse:x.warehouse,
  "Sent PCS":x.shippedPcs,"Received PCS":x.receivedPcs,
  "Receipt Pending":x.pendingPcs,Status:x.status,Document:x.documentId
 }));
 if(["transfers","outward","history","reports"].includes(mode))return history.map(x=>({
  "Date":x.date||"",Action:x.kind,Department:x.department,
  Warehouse:x.warehouse,"DC":x.dcNo,SKU:x.sku,Carton:x.cartonNo,
  PCS:x.quantity,Stage:x.stage,"ERP Document":x.documentId
 }));
 if(["stock","overview"].includes(mode))return stocks.map(x=>({
  Warehouse:x.warehouse,SKU:x.sku,Colour:x.colour,Size:x.size,Bin:x.bin||"UNASSIGNED",
  "Stock PCS":x.quantity,Bundles:x.bundleCount
 }));
 return bundles.map(x=>({Bundle:x.code,Warehouse:x.warehouse,DC:x.dcNo,
  SKU:x.sku,Stage:x.stage,"PCS":x.quantity,Bin:x.bin||"UNASSIGNED",
  "Age Hours":x.ageHours??""}));
}
