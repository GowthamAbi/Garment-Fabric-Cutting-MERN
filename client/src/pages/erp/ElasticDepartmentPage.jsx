import {useEffect,useMemo,useState} from "react";
import {RefreshCw,Save,Download,Printer} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {elasticApi} from "../../api/elasticApi.js";
const titles={
 overview:"Elastic Dashboard",plans:"Elastic Plan Overview",availability:"Material Availability",
 target:"Target vs Actual",progress:"Elastic Cutting Progress",issues:"Pending Issues / Shortage",
 waste:"Wastage Monitoring",reports:"Elastic Reports",
 master:"Elastic Material Master",inward:"Elastic Purchase / Inward",plan:"Elastic Cutting Plan",
 cut:"Elastic Cutting Entry",return:"Elastic Issue / Return",stock:"Elastic Stock & Balance",
 correction:"Wastage / Correction Request",history:"Elastic History",
};
const blank={code:"",name:"",minimumQty:"0",sku:"",partyCode:"",purchaseOrderId:"",
 fabricPlanNo:"",planNo:"",lineKey:"",reference:"",quantity:"",rate:"0",countedMtr:"0",reason:""};
const format=x=>Number(x||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const empty={summary:{},stock:[],plans:[],purchases:[],history:[],corrections:[],suppliers:[]};
const fields={
 master:[["Material SKU","code"],["Material Name","name"],["Minimum Stock (MTR)","minimumQty","number"]],
 plan:[["Fabric Cutting Plan No","fabricPlanNo"],["Elastic Plan No (optional)","planNo"]],
 cut:[["Cutting / Issue Reference","reference"],["Quantity (MTR)","quantity","number"]],
 correction:[["Correction Reference","reference"],["Physical Count (MTR)","countedMtr","number"],["Reason","reason"]],
};
function Grid({head,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{minWidth:740,width:"100%"}}>
  <thead><tr>{head.map(x=><th key={x}>{x}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
    <tr><td colSpan={head.length}>No records available.</td></tr>}</tbody>
 </table></div>;
}
export default function ElasticDepartmentPage({mode="overview",notify}){
 const {user}=useAuth();
 const readonly=user?.role==="department_incharge";
 const [data,setData]=useState(empty),[form,setForm]=useState(blank),[loading,setLoading]=useState(false);
 const [purchaseAction,setPurchaseAction]=useState("purchase"),[returnAction,setReturnAction]=useState("cut");
 const [search,setSearch]=useState("");
 const load=async()=>{try{setData(await elasticApi.overview())}catch(e){notify?.(e.message)}};
 useEffect(()=>{load()},[]);
 const title=titles[mode]||"Elastic";
 const edit=(key,value)=>setForm(f=>({...f,[key]:value}));
 const stock=useMemo(()=>(data.stock||[]).filter(x=>[x.code,x.name].join(" ").toLowerCase().includes(search.toLowerCase())),[data.stock,search]);
 const stockTable=stock.map(r=>[r.code,r.name,r.unit,format(r.available),format(r.minimum),format(r.shortage),r.lowStock?"LOW":"OK"]);
 const planTable=(data.plans||[]).map(p=>[p.planNo,p.fabricPlanNo,p.dcNo,p.sku,format(p.targetMtr),format(p.cutMtr),format(p.pendingMtr),p.completionPercent+"%"]);
 const purchaseTable=(data.purchases||[]).flatMap(p=>p.lines.map(l=>[p.number,p.partyCode,l.sku,format(l.orderedMtr),format(l.receivedMtr),format(l.pendingMtr)]));
 const historyTable=(data.history||[]).map(h=>[h.number,h.kind,h.planNo,h.reference,h.sku,(h.colour||"")+" / "+(h.size||""),format(h.quantity),h.date?new Date(h.date).toLocaleDateString():""]);
 const correctionTable=(data.corrections||[]).map(c=>[c.reference,c.sku,format(c.expectedMtr),format(c.countedMtr),format(c.varianceMtr),c.reason,c.status]);
 const showStock=["overview","availability","stock","issues","waste","reports"].includes(mode);
 const showPlans=["overview","plans","target","progress","issues","reports"].includes(mode);
 const showPurchases=["inward","availability","issues","reports"].includes(mode);
 const showHistory=["history","progress","waste","reports"].includes(mode);
 const showCorrections=["correction","waste","issues","reports"].includes(mode);
 const editMode=["master","inward","plan","cut","return","correction"].includes(mode);
 const skuOptions=(data.stock||[]).map(x=>({value:x.code,label:x.code+" – "+x.name}));
 const poOptions=(data.purchases||[]).filter(x=>x.lines.some(l=>l.pendingMtr>0)).map(x=>({value:x.id,label:x.number}));
 const planOptions=(data.plans||[]).filter(x=>x.pendingMtr>0).map(x=>({value:x.planNo,label:x.planNo+" · Pending "+format(x.pendingMtr)+" MTR"}));
 const returnOptions=(data.plans||[]).filter(x=>x.cutMtr>0).map(x=>({value:x.planNo,label:x.planNo+" · Issued "+format(x.cutMtr)+" MTR"}));
 const suppliers=(data.suppliers||[]).map(x=>({value:x.code,label:x.code+" – "+x.name}));
 const select=(label,key,options)=><label key={key}>{label}
   <select value={form[key]} onChange={e=>edit(key,e.target.value)} required>
     <option value="">Select…</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
   </select></label>;
 const input=(label,key,type="text",optional=false)=><label key={key}>{label}
   <input type={type} step={type==="number"?"0.001":undefined} min={type==="number"?"0":undefined}
     value={form[key]} maxLength={180} required={!optional} onChange={e=>edit(key,e.target.value)}/>
 </label>;
 async function submit(e){
   e.preventDefault();if(readonly||loading)return;
   setLoading(true);
   try{
     let result;
     if(mode==="master")result=await elasticApi.material(form);
     if(mode==="inward")result=await (purchaseAction==="inward"?elasticApi.inward(form):elasticApi.purchase(form));
     if(mode==="plan")result=await elasticApi.plan(form);
     if(mode==="cut")result=await elasticApi.cut({...form,colour:form.lineKey.split("::")[0],size:form.lineKey.split("::")[1]});
     if(mode==="return"){const body={...form,colour:form.lineKey.split("::")[0],size:form.lineKey.split("::")[1]};
       result=await (returnAction==="return"?elasticApi.return(body):elasticApi.cut(body));}
     if(mode==="correction")result=await elasticApi.correction(form);
     notify?.("Elastic saved: "+(result?.planNo||result?.number||result?.reference||result?.code||"record"));
     setForm(blank);await load();
   }catch(error){notify?.(error.message)}finally{setLoading(false)}
 }
 const exportRows=mode==="plans"||mode==="progress"||mode==="target"?planTable:
   mode==="history"?historyTable:mode==="waste"||mode==="correction"?correctionTable:
   mode==="inward"?purchaseTable:stockTable;
 return <section className="classic-page">
   <div className="classic-title"><div><small>ELASTIC DEPARTMENT · {readonly?"HEAD / READ ONLY":"STAFF"}</small>
    <h2>{title}</h2><p>Fabric Cutting requirements and Elastic stock tracked with the integrated ERP ledger.</p>
   </div><div className="page-actions">
     <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
     <button type="button" disabled={!exportRows.length} onClick={()=>exportCsv("elastic-"+mode+".csv",
       exportRows.map(r=>Object.fromEntries(r.map((v,i)=>[String(i+1),v]))))}><Download size={16}/> Excel</button>
     <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
   </div></div>
   {mode==="overview"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
     {Object.entries({"Materials":data.summary?.materials||0,"Low Stock":data.summary?.lowStock||0,
       "Cutting Plans":data.summary?.plans||0,"Target MTR":data.summary?.targetMtr||0,
       "Cut MTR":data.summary?.cutMtr||0,"Pending MTR":data.summary?.pendingMtr||0,
       "Correction Requests":data.summary?.wastePending||0}).map(([key,value])=>
         <div className="classic-card" key={key}><small>{key}</small><h3>{format(value)}</h3></div>)}
   </div>}
   {editMode&&readonly&&<div className="classic-card">Elastic Head can review records, not create stock or cutting entries.</div>}
   {editMode&&!readonly&&<form className="classic-card" onSubmit={submit}>
     <h3>{title}</h3>
     {mode==="inward"&&<label>Entry Type
       <select value={purchaseAction} onChange={e=>{setPurchaseAction(e.target.value);setForm(blank)}}>
         <option value="purchase">Purchase Order</option><option value="inward">Goods Receipt against PO</option>
       </select></label>}
     {mode==="return"&&<label>Entry Type
       <select value={returnAction} onChange={e=>{setReturnAction(e.target.value);setForm(blank)}}>
         <option value="cut">Issue to Delivery (Cutting)</option><option value="return">Return from Delivery</option>
       </select></label>}
     <div className="form-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
       {mode==="master"&&fields.master.map(([label,key,type])=>input(label,key,type))}
       {mode==="inward"&&(purchaseAction==="inward"?select("Purchase Order","purchaseOrderId",poOptions):
         select("Supplier","partyCode",suppliers))}
       {["inward","plan","correction"].includes(mode)&&select("Elastic Material SKU","sku",
         mode==="inward"&&purchaseAction==="inward"
          ?((data.purchases||[]).find(p=>p.id===form.purchaseOrderId)?.lines||[]).filter(l=>l.pendingMtr>0).map(l=>({value:l.sku,label:l.sku}))
          :skuOptions)}
       {mode==="plan"&&fields.plan.map(([label,key])=>input(label,key,"text",key==="planNo"))}
       {(mode==="cut"||mode==="return")&&select("Elastic Plan No","planNo",mode==="return"&&returnAction==="return"?returnOptions:planOptions)}
       {(mode==="cut"||mode==="return")&&select("Colour / Size","lineKey",
         ((data.plans||[]).find(x=>x.planNo===form.planNo)?.sizeProgress||[])
           .filter(x=>mode==="return"&&returnAction==="return"?x.cutMtr>0:x.pendingMtr>0)
           .map(x=>({value:x.colour+"::"+x.size,
             label:x.colour+" / "+x.size+" · "+format(mode==="return"&&returnAction==="return"?x.cutMtr:x.pendingMtr)+" MTR"})))}
       {(mode==="inward"||mode==="cut"||mode==="return")&&input("Quantity (MTR)","quantity","number")}
       {mode==="inward"&&purchaseAction==="purchase"&&input("Rate (₹ / MTR)","rate","number")}
       {(mode==="cut"||mode==="return")&&input("Document Reference","reference")}
       {mode==="return"&&returnAction==="return"&&select("Elastic SKU","sku",skuOptions)}
       {mode==="correction"&&fields.correction.map(([label,key,type])=>input(label,key,type))}
     </div>
     {mode==="plan"&&<p>Plan demand is calculated from completed Fabric Cutting Actual and approved size-wise Elastic measurements.</p>}
     {mode==="correction"&&<p>Request only. Stock correction needs approval and controlled ERP posting; it does not change balance now.</p>}
     <button type="submit" disabled={loading}><Save size={16}/> {loading?"Saving…":"Save Entry"}</button>
   </form>}
   {showStock&&<div className="classic-card"><h3>Elastic Stock & Material Availability</h3>
     <label>Search SKU <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Material code/name"/></label>
     <Grid head={["SKU","Name","Unit","Available MTR","Minimum MTR","Shortage MTR","Status"]} rows={stockTable}/>
   </div>}
   {showPlans&&<div className="classic-card"><h3>Elastic Plan / Target vs Actual</h3>
     <Grid head={["Elastic Plan","Fabric Plan","DC","SKU","Target MTR","Issued MTR","Pending MTR","Progress"]} rows={planTable}/>
     <small>Cutting figures represent posted ERP transfers, not unrestricted production counter entries.</small>
   </div>}
   {showPurchases&&<div className="classic-card"><h3>Elastic Inward & Purchase Status</h3>
     <Grid head={["PO","Supplier","SKU","Ordered MTR","Received MTR","Pending MTR"]} rows={purchaseTable}/>
   </div>}
   {showHistory&&<div className="classic-card"><h3>Elastic Issue / Return History</h3>
     <Grid head={["Document No","Action","Plan","Reference","SKU","Colour / Size","MTR","Date"]} rows={historyTable}/>
   </div>}
   {showCorrections&&<div className="classic-card"><h3>Wastage / Correction Requests (Pending Approval)</h3>
     <Grid head={["Reference","SKU","Ledger MTR","Physical MTR","Variance MTR","Reason","Status"]} rows={correctionTable}/>
     <small>Wastage is not yet an approved stock write-off; Head approval and ledger adjustment remain pending.</small>
   </div>}
 </section>;
}
