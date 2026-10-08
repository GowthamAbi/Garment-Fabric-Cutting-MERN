import {money,fail} from "./policy.js";
export function parseStatement(csv){
  const todayParts=new Intl.DateTimeFormat("en",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=k=>todayParts.find(p=>p.type===k).value,today=`${part("year")}-${part("month")}-${part("day")}`;
  if(typeof csv!=="string"||csv.length>500000)fail("CSV must be at most 500 KB");
  const rows=[];let row=[],cell="",quoted=false;
  const value=csv.replace(/^\ufeff/,"");
  for(let i=0;i<=value.length;i++){
    const c=value[i]??"\n";
    if(c==='"'){if(quoted&&value[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else fail("Malformed CSV quote");}
    else if(c===","&&!quoted){row.push(cell);cell="";}
    else if((c==="\n"||c==="\r")&&!quoted){row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell="";if(c==="\r"&&value[i+1]==="\n")i++;}
    else cell+=c;
    if(rows.length>2001)fail("At most 2,000 statement rows per import");
  }
  if(quoted)fail("Unclosed CSV quote");
  if(rows.shift()?.map(v=>v.trim().toLowerCase()).join(",")!=="date,reference,amount")fail("CSV header must be date,reference,amount");
  const result=rows.map(r=>{
    if(r.length!==3)fail("Each statement row needs three fields");
    const [date,reference,signed]=r.map(v=>v.trim()),at=new Date(date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(at.getTime())||at.toISOString().slice(0,10)!==date||date>today)fail("Invalid/future statement date");
    if(!reference||reference.length>100||! /^-?\d+(\.\d{1,2})?$/.test(signed))fail("Reference and signed INR amount required");
    const amount=money(signed.replace(/^-/,""))*(signed.startsWith("-")?-1:1);if(!amount)fail("Zero bank movement is invalid");
    return {date,reference,amount};
  });
  if(new Set(result.map(r=>r.reference)).size!==result.length)fail("Duplicate references in CSV; resolve ambiguous bank references before import");
  return result;
}
