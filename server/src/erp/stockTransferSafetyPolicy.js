// Transfers require authorization over the origin; the destination
// validates its own role/assigned location before physical receipt.
export function crossDepartmentHandoff(sourceStage,nextStage){
 const source=String(sourceStage||""),next=String(nextStage||"");
 return (source==="PACKED"&&next==="TRANSIT_WAREHOUSE")||
  (source.startsWith("WAREHOUSE:")&&next.startsWith("TRANSIT_SHOP:"))||
  (source.startsWith("SHOP:")&&(next==="TRANSIT_WAREHOUSE"||next.startsWith("TRANSIT_SHOP:")));
}
// Warehouse report must not reveal shop-bound transit from unassigned origins.
// Dedicated warehouse overview resolves origin via parent bundle.
export function warehouseDashboardStageVisible(stage){
 return !String(stage||"").startsWith("TRANSIT_SHOP:");
}
