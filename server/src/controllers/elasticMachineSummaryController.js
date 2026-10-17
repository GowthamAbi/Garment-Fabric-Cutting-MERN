import Machine from "../models/Machine.js";
import ProductionJob from "../models/ProductionJob.js";
import ApiError from "../utils/ApiError.js";

// Read-only bridge to the legacy machine timeline; do not move stock or
// count this as a posting into the new ELASTIC ERP ledger.
export async function elasticMachineSummary(_req,res){
  const from=new Date();
  from.setUTCDate(from.getUTCDate()-8);
  const jobs=await ProductionJob.find({
    section:/elastic/i,
    $or:[{startTime:{$gte:from}},{status:{$nin:["Completed","Rejected"]}}],
  }).sort({startTime:-1}).limit(1001).lean();
  if(jobs.length>1000)throw new ApiError(409,"Elastic timeline exceeds 1000 jobs; filter/archive before reporting");
  const codes=[...new Set(jobs.map(j=>j.machineCode).filter(Boolean))];
  const machines=await Machine.find({$or:[
    {section:/elastic/i},{machineType:/elastic/i},
    ...(codes.length?[{machineCode:{$in:codes}}]:[]),
  ]}).sort({machineCode:1}).limit(501).lean();
  if(machines.length>500)throw new ApiError(409,"Elastic timeline exceeds 500 machines; archive before reporting");
  const permitted=new Set(machines.map(m=>m.machineCode));
  const elasticJobs=jobs.filter(j=>permitted.has(j.machineCode));
  res.json({machines,jobs:elasticJobs,
    counts:{machines:machines.length,running:elasticJobs.filter(j=>j.status==="Running").length,
      stopped:elasticJobs.filter(j=>!["Completed","Rejected","Running"].includes(j.status)).length,
      completed:elasticJobs.filter(j=>j.status==="Completed").length},
  });
}
