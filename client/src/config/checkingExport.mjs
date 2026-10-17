// Excel-compatible records contain numbers without locale formatting.
export function checkingExportRecords(mode,data={},filtered={}){
 const {lots=[],bundles=[],inspections=[],defects=[],history=[],holds=[]}=filtered;
 if(mode==="defects")return defects.map(d=>({
  "Defect Category":d.category,"Inspections":d.inspections,
  "Rework PCS":d.reworkPcs,"Oil PCS":d.oilPcs,"Reject PCS":d.rejectPcs
 }));
 if(["entry","split","recheck","oil","scan","bundles","pending"].includes(mode))
  return bundles.map(b=>({"Bundle":b.bundleNo,"Lot":b.lotNo,"DC":b.dcNo,
   "SKU":b.sku,"Section":b.vendor,"Status":b.stage,"Qty PCS":b.quantity,
   "Recheck Cycle":b.cycle}));
 if(["hold","holds"].includes(mode))return holds.map(h=>({
   "Date":h.createdAt||"","DC":h.dcNo,"Lot":h.lotNo,
   "Bundle":h.bundleNo,"Category":h.category,"Expected PCS":h.expectedPcs,
   "Status":h.status,"Reason":h.reason
 }));
 if(mode==="history")return history.map(e=>({
  "Date":e.date||"","DC":e.dcNo,"Lot":e.lotNo,"Action":e.kind,
  "Qty PCS":e.quantity,"Next Stage":e.nextStage,"Defect":e.defect,
  "Journal":e.documentId
 }));
 if(["classify","results","reports"].includes(mode))return inspections.map(e=>({
  "Date":e.date||"","DC":e.dcNo,"Lot":e.lotNo,"SKU":e.sku,
  "Inspected PCS":e.total,"Pass PCS":e.good,"Rework PCS":e.rework,
  "Oil PCS":e.oil,"Reject PCS":e.reject,"Defect":e.defect
 }));
 return lots.map(l=>({"Lot":l.lotNo,"DC":l.dcNo,"Order":l.orderNo,
  "Section":l.vendor,"SKU":l.sku,"Pending PCS":l.pendingPcs,
  "Good Stock PCS":l.goodStockPcs,"Rework PCS":l.reworkStockPcs,
  "Oil PCS":l.oilStockPcs,"Reject PCS":l.wasteStockPcs}));
}
