export const ERP_FEATURES=["ERP_CORE","ERP_SHOP_FLOOR","ERP_FINANCE","ERP_HR"];
export function featureAllowed(modules,feature){
  const configured=(modules||[]).filter(m=>ERP_FEATURES.includes(m));
  // Existing department-only plans preserve legacy access until explicitly configured.
  return configured.length===0||configured.includes(feature);
}
export function featureForRequest(path,type){
  if(path.startsWith("/workforce"))return "ERP_HR";
  if(path.startsWith("/departments"))return "ERP_CORE";
  if(path.startsWith("/operations"))return "ERP_SHOP_FLOOR";
  if(path.endsWith("/reconcile")||["/financials","/commercial","/bank"].some(p=>path===p||path.startsWith(p+"/"))||["JOURNAL","RECEIPT","PAYMENT","WORK_COST"].includes(type))return "ERP_FINANCE";
  return "ERP_CORE";
}
