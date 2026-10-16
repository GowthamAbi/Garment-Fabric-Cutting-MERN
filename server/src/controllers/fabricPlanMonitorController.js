// Read-only monitoring of legacy FabricCutPlan data.
// Legacy plans do not store factoryId. Fail closed for multi-factory companies,
// rather than exposing another factory's production planning records.
import FabricCutPlan from "../models/FabricCutPlan.js";
import Company from "../models/Company.js";
import ApiError from "../utils/ApiError.js";

const clean=value=>String(value||"").trim().toUpperCase();

export function fabricPlanMonitorQuery(input={}){
 const result={};
 for(const key of ["planNo","dcNo"]){
  const value=clean(input[key]);
  if(value){
   if(value.length>100||!/^[A-Z0-9\/_-]+$/.test(value))throw new ApiError(400,"Invalid "+key+" filter");
   result[key]=value;
  }
 }
 if(input.status){
  const status=clean(input.status);
  if(!["PLANNED","PART_ISSUED","READY","RUNNING","PARTIAL","COMPLETED","HOLD"].includes(status))
   throw new ApiError(400,"Invalid plan status");
  result.status=status;
 }
 if(input.from||input.to){
  result.createdAt={};
  for(const [name,operator] of [["from","$gte"],["to","$lte"]]){
   if(!input[name])continue;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(input[name])))throw new ApiError(400,"Invalid date filter");
   const day=new Date(String(input[name])+"T00:00:00.000Z");
   if(Number.isNaN(day.getTime())||day.toISOString().slice(0,10)!==String(input[name]))throw new ApiError(400,"Invalid calendar date");
   if(name==="to")day.setUTCHours(23,59,59,999);
   result.createdAt[operator]=day;
  }
  if(result.createdAt.$gte&&result.createdAt.$lte&&result.createdAt.$gte>result.createdAt.$lte)
   throw new ApiError(400,"From date cannot exceed to date");
 }
 return result;
}
export function isSingleFactoryScope(company,factoryId){
 const factories=(company?.factories||[]).filter(factory=>factory.active!==false);
 return Boolean(company?.active&&factories.length===1&&String(factories[0]._id)===String(factoryId));
}
export async function monitorFabricPlans(req,res){
 const company=await Company.findById(req.user.companyId).select("factories active").lean();
 if(!isSingleFactoryScope(company,req.user.factoryId))
  throw new ApiError(409,"Legacy fabric plans are not factory-tagged. Monitoring is unavailable until factory-scoped plan migration is completed.");
 const filter=fabricPlanMonitorQuery(req.query);
 const rows=await FabricCutPlan.find(filter)
  .select("planNo dcNo orderNo itemCode itemName fabricGroup totalPlannedPcs totalWantedWeightKg issuedWeightKg status allocations createdAt")
  .sort({createdAt:-1}).limit(250).lean();
 res.json({items:rows,limit:250,readOnly:true,legacySingleFactoryScope:true});
}
