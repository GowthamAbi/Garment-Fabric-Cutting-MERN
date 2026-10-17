// Spreadsheet records preserve numeric quantities for arithmetic.
export function packingExportRecords(mode,filtered={}){
 const {plans=[],lots=[],bundles=[],history=[],masters=[],issues=[]}=filtered;
 if(["plan","overview"].includes(mode))return plans.map(p=>({
  Date:p.date,SKU:p.sku,DC:p.dcNo,"Target PCS":p.targetPcs,"Packed PCS":p.actualPcs,
  "Balance PCS":p.balancePcs,"Achievement %":p.achievementPercent,
  "Packing Master":p.packingMasterKey,Notes:p.notes}));
 if(["issue","issues"].includes(mode))return issues.map(x=>({
  DC:x.dcNo,Lot:x.lotNo,Carton:x.cartonNo,Issue:x.category,
  "Issue PCS":x.quantity,Status:x.status,Reason:x.reason}));
 if(["history","reports"].includes(mode))return history.map(h=>({
  "UTC Date":h.date,DC:h.dcNo,Lot:h.lotNo,SKU:h.sku,
  "Packed PCS":h.quantity,Carton:h.cartonNo,"Document ID":h.documentId}));
 if(["materials","material-issue"].includes(mode)){
  if(mode==="material-issue")return history.flatMap(h=>h.materials.map(m=>({
    "UTC Date":h.date,Carton:h.cartonNo,DC:h.dcNo,"Packed PCS":h.quantity,
    "Material SKU":m.sku,"Consumed Qty":m.quantity
  })));
  return bundles.filter(b=>b.stage==="IRONED").flatMap(b=>b.materials.map(m=>({
    Bundle:b.bundleNo,DC:b.dcNo,"Packing Master":b.packingMasterKey,
    "Required for Bundle":m.requiredQty,"Material SKU":m.sku,
    "Available Qty":m.availableQty,"Shortage Qty":m.shortageQty,Ready:m.sufficient?"YES":"NO"
  })));
 }
 if(mode==="master")return masters.map(m=>({
  Master:m.key,SKU:m.sku,Name:m.name,Status:m.active?"ACTIVE":"INACTIVE",
  "Materials":m.materials.map(x=>`${x.sku} ${x.quantity} per ${x.perPieces} PCS`).join("; ")
 }));
 if(["ready","entry","label","stock","handover","assortment"].includes(mode))return bundles.map(b=>({
  Bundle:b.bundleNo,DC:b.dcNo,Lot:b.lotNo,SKU:b.sku,Colour:b.colour,Size:b.size,
  Section:b.section,Stage:b.stage,"Pieces":b.quantity,"Packing Master":b.packingMasterKey}));
 return lots.map(l=>({
  Lot:l.lotNo,DC:l.dcNo,Order:l.orderNo,SKU:l.sku,Colour:l.colour,Size:l.size,
  "Ready to Pack PCS":l.readyToPackPcs,"Packed Awaiting Dispatch":l.packedAwaitingDispatchPcs
 }));
}
