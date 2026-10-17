// Stitching Excel export must match the currently selected report.
// A combined report uses a fixed union of columns because exportCsv reads
// column names from the FIRST row only.
const val=x=>Number(x||0);
const date=x=>x?(x instanceof Date?x.toISOString():String(x)):"";
const lot=p=>({
  "Lot":p.lotNo||"","Order":p.orderNo||"","DC":p.dcNo||"",
  "SKU":p.sku||"","Section / Vendor":p.section||"",
  "Sent PCS":val(p.sentPcs),"Stitched PCS":val(p.stitchedPcs),
  "Handed Over PCS":val(p.handedOverPcs),"Pending PCS":val(p.pendingPcs),
  "Rework PCS":val(p.reworkPcs),"Completion %":val(p.completionPercent)
});
const op=o=>({"SKU":o.sku||"","Master":o.masterKey||"",
  "Sequence":val(o.sequence),"Operation":o.operation||"",
  "Completed Event PCS":val(o.completedEventPcs)});
const target=t=>({"Date":date(t.date),"SKU":t.sku||"",
  "Operation":t.operation||"","Operator":t.operator||"",
  "Shift":t.shift||"","Target PCS":val(t.targetPcs)});
const defect=d=>({"Date":date(d.date),"Lot":String(d.lotId||""),
  "Event":d.kind||"","Department":d.department||"",
  "Quantity PCS":val(d.quantity),"Reason":d.reason||""});

export function stitchingExportRecords(mode,data={},visiblePlans=[]){
 const plans=visiblePlans.map(lot);
 const operations=(data.operations||[]).map(op);
 const targets=(data.targets||[]).map(target);
 const defects=(data.defects||[]).map(defect);
 if(mode==="targets")return targets;
 if(["operations","bulletin","completion"].includes(mode))return operations;
 if(["defects","rework"].includes(mode))return defects;
 if(mode!=="reports")return plans;
 const source=[
  ...plans.map(x=>["Lot Progress",x]),
  ...operations.map(x=>["Operation Completions",x]),
  ...targets.map(x=>["Targets",x]),
  ...defects.map(x=>["Defects / Rework",x])
 ];
 const fields=[...new Set(source.flatMap(([,item])=>Object.keys(item)))];
 return source.map(([section,item])=>({
  "Report Section":section,
  ...Object.fromEntries(fields.map(field=>[field,item[field]??""]))
 }));
}
