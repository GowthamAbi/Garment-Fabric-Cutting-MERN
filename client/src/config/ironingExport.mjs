// Report-specific Excel-compatible rows. Keep numeric PCS raw for calculations.
export function ironingExportRecords(mode,rows={}){
 const {lots=[],bundles=[],history=[],targets=[],issues=[]}=rows;
 if(mode==="targets")return targets.map(t=>({"Date (UTC)":t.date,SKU:t.sku,
  Operator:t.operator,Shift:t.shift,"Target PCS":t.targetPcs,"Actual PCS":t.actualPcs,
  "Balance PCS":t.balancePcs,"Achievement %":t.achievementPercent}));
 if(["issues","damage"].includes(mode))return issues.map(t=>({
  "DC":t.dcNo,"Lot":t.lotNo,"Bundle":t.bundleNo,"Stage":t.stage,
  "Issue":t.category,"Issue PCS":t.quantity,"Request Status":t.status,"Reason":t.reason
 }));
 if(["history","completed","reports","print"].includes(mode))return history.map(t=>({
  "Date (UTC)":t.date,"DC":t.dcNo,"Lot":t.lotNo,SKU:t.sku,
  "Section":t.section,"PCS":t.quantity,"Stage":t.nextStage,
  Operator:t.operator,Shift:t.shift,"Journal":t.documentId
 }));
 if(["queue","received","entry","handover","qr","delays"].includes(mode))return bundles.map(b=>({
  "Bundle":b.bundleNo,"DC":b.dcNo,"Lot":b.lotNo,"Section":b.section,
  SKU:b.sku,Stage:b.stage,"Pieces":b.quantity,"Age Hours":b.ageHours??""
 }));
 return lots.map(l=>({"Lot":l.lotNo,"DC":l.dcNo,"Order":l.orderNo,"Section":l.section,
  SKU:l.sku,"Ready from QC":l.receivedReadyPcs,"Ironing WIP":l.ironingWipPcs,
  "Ready for Packing":l.ironedReadyForPackingPcs}));
}
