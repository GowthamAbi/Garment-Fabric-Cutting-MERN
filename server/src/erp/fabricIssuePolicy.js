import ApiError from "../utils/ApiError.js";
export function assertFabricIssueRequest(body){
 const number=String(body?.planNo||"").trim().toUpperCase();
 const inwardNo=String(body?.inwardNo||"").trim().toUpperCase();
 const colour=String(body?.colour||"").trim().toUpperCase();
 const dia=String(body?.dia||"").trim().toUpperCase();
 const weight=Number(body?.weightKg);
 const key=String(body?.key||"").trim();
 if(!/^[A-Z0-9_\/-]{1,100}$/.test(number)||!/^[A-Z0-9_\/-]{1,100}$/.test(inwardNo)||!/^[A-Z0-9_\/-]{1,100}$/.test(colour)||!/^[A-Z0-9.\/_ -]{1,40}$/.test(dia))
   throw new ApiError(400,"Select valid Plan, Inward and Colour");
 if(!Number.isFinite(weight)||weight<=0||weight>100000||Math.round(weight*1000)/1000!==weight)
   throw new ApiError(400,"Issue weight must be 0.001–100000 KG, maximum three decimals");
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))
   throw new ApiError(400,"A unique 16–100 character issue request key is required");
 return {planNo:number,inwardNo,colour,dia,weightKg:weight,key};
}
export function remainingColourWeight(plan,colour){
 const row=(plan?.colours||[]).find(c=>String(c.colour).toUpperCase()===colour);
 if(!row)return null;
 const issued=(plan.allocations||[]).filter(a=>String(a.colour).toUpperCase()===colour).reduce((n,a)=>n+Number(a.weightKg||0),0);
 return Math.max(0,Math.round((Number(row.wantedWeightKg||0)-issued)*1000)/1000);
}
export function sumRollBalance(bundles){
 return Math.round(bundles.reduce((n,b)=>n+Number(b.balanceWeightKg||0),0)*1000)/1000;
}

export function remainingDiaWeight(plan,colour,dia){
 const colourRow=(plan?.colours||[]).find(c=>String(c.colour).toUpperCase()===colour);
 if(!colourRow)return null;
 const sizes=(colourRow.sizes||[]).filter(s=>String(s.dia||"").trim().toUpperCase()===dia);
 if(!sizes.length)return null;
 // Old issue allocations did not carry Dia: mixed-Dia plans cannot safely
 // attribute their historical stock issue to one Dia.
 const legacy=(plan.allocations||[]).filter(a=>String(a.colour).toUpperCase()===colour&&!a.dia);
 const uniqueDias=new Set((colourRow.sizes||[]).map(s=>String(s.dia||"").toUpperCase()));
 if(legacy.length&&uniqueDias.size>1)return null;
 const issued=(plan.allocations||[]).filter(a=>String(a.colour).toUpperCase()===colour&&(String(a.dia||"").toUpperCase()===dia||(!a.dia&&uniqueDias.size===1))).reduce((n,a)=>n+Number(a.weightKg||0),0);
 return Math.max(0,Math.round((sizes.reduce((n,s)=>n+Number(s.wantedWeightKg||0),0)-issued)*1000)/1000);
}
