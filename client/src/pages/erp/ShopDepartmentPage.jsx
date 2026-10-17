import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {BundleTrace} from "./Departments.jsx";
import OfflinePos from "./OfflinePos.jsx";
import {getShopOverview,receiveShopTransit,createShopSale,
 requestCustomerReturn,returnSoldGoods,transferShopStock,
 requestShopStockCount,createShopMaster} from "../../api/shopDepartmentApi.js";
import {shopExportRecords} from "../../config/shopExport.mjs";
import "./ShopDepartmentPage.css";
const titles={
 sales:"Shop Sales Overview",margin:"Sales Margin",stock:"Shop Stock",
 receipts:"Warehouse Transfer Status",returns:"Sales Returns / Discounts",
 issues:"Pending Stock Issues",reports:"Shop Reports",
 pos:"POS / Sales Entry",invoice:"Customer Sales Invoice",
 payment:"Payment Collection",receipt:"Warehouse Stock Receipt",
 transfer:"Shop Stock Transfer",return:"Sales Return Request",
 count:"Stock Count / Adjustment",print:"Invoice Print",
 history:"Sales History / Reports"
};
const defaultData={summary:{},shops:[],stock:[],stockBySku:[],incoming:[],
 receipts:[],invoices:[],returns:[],requests:[],transfers:[],shopSales:[]};
const money=p=>"₹"+(Number(p||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const num=n=>Number(n||0).toLocaleString("en-IN");
function Grid({headers,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:810}}>
  <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={headers.length}>No matching Shop records.</td></tr>}</tbody>
 </table></div>;
}
export default function ShopDepartmentPage({mode="sales",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(defaultData),[search,setSearch]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [bundleId,setBundleId]=useState(""),[quantity,setQuantity]=useState(""),[shop,setShop]=useState(""),
  [target,setTarget]=useState(""),[trace,setTrace]=useState(""),[invoiceId,setInvoiceId]=useState("");
 const [unitPrice,setUnitPrice]=useState(""),[discount,setDiscount]=useState("0"),
  [taxPercent,setTaxPercent]=useState("0"),[taxType,setTaxType]=useState("NO_TAX"),
  [paymentMode,setPaymentMode]=useState("CASH"),[customer,setCustomer]=useState(""),
  [phone,setPhone]=useState(""),[gstin,setGstin]=useState("");
 const [kind,setKind]=useState("QUALITY"),[reason,setReason]=useState(""),
  [counted,setCounted]=useState(""),[difference,setDifference]=useState("MISSING");
 const [masterKey,setMasterKey]=useState(""),[masterName,setMasterName]=useState("");
 const keys=useRef(Object.fromEntries(["pos","receipt","transfer","return","refund","count","master"]
   .map(x=>[x,crypto.randomUUID()])));
 async function load(){try{setData(await getShopOverview());setError("")}
  catch(e){setError(e.message);notify?.(e.message)}}
 useEffect(()=>{load()},[]);
 const match=(...args)=>args.some(a=>String(a??"").toLowerCase().includes(search.trim().toLowerCase()));
 const filtered=useMemo(()=>({
  stock:(data.stock||[]).filter(x=>match(x.bundleNo,x.shop,x.sku,x.dcNo,x.size,x.colour)),
  stockBySku:(data.stockBySku||[]).filter(x=>match(x.shop,x.sku,x.size,x.colour)),
  incoming:(data.incoming||[]).filter(x=>match(x.shop,x.bundleNo,x.sku)),
  receipts:(data.receipts||[]).filter(x=>match(x.shop,x.bundleNo,x.status)),
  invoices:(data.invoices||[]).filter(x=>match(x.number,x.shop,x.sku,x.paymentMode)),
  requests:(data.requests||[]).filter(x=>match(x.invoice,x.shop,x.sku,x.kind,x.status)),
  shopSales:(data.shopSales||[]).filter(x=>match(x.shop)),
  transfers:(data.transfers||[]).filter(x=>match(x.shop,x.destination,x.bundleNo))
 }),[data,search]);
 const selected=(data.stock||[]).concat(data.incoming||[]).find(x=>x.id===bundleId);
 const selectedSale=(data.invoices||[]).find(x=>x.id===invoiceId);
 const displayInvoice=["invoice","print"].includes(mode);
 const stockForPos=filtered.stock,validQty=selected&&Number.isSafeInteger(Number(quantity))&&
  Number(quantity)>0&&Number(quantity)<=selected.quantity;
 const exportData={...filtered};
 if(mode==="print")exportData.invoices=selectedSale?[selectedSale]:[];
 const csv=shopExportRecords(mode==="print"?"invoice":mode,exportData),summary=data.summary||{};
 async function run(e,keyName,save,onSuccess){
  e.preventDefault();setError("");setBusy(true);
  try{
   const result=await save(keys.current[keyName]);
   keys.current[keyName]=crypto.randomUUID();
   await load();onSuccess?.(result);notify?.("Shop ERP operation saved");
  }catch(err){setError(err.message);notify?.(err.message)}
  finally{setBusy(false)}
 }
 const receiptSale=["invoice","print","history","reports","payment"].includes(mode);
 return <section className={`classic-page shop-dept ${displayInvoice?"shop-print-invoice":""}`}>
  <div className="shop-not-receipt">
   <header className="classic-title">
    <div><small>SHOP · {readonly?"HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
     <h2>{titles[mode]||"Shop Department"}</h2>
     <p>Paid Cash/Bank POS sales, warehouse inbound and authentic stock/finance documents.</p>
    </div><div className="page-actions">
     <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
     <button type="button" disabled={!csv.length} onClick={()=>exportCsv("shop-"+mode+".xls",csv)}>
      <Download size={16}/> Excel</button>
     <button type="button" disabled={displayInvoice&&!selectedSale} onClick={()=>window.print()}>
      <Printer size={16}/> Print</button>
    </div>
   </header>
   {error&&<p className="error-text" role="alert">{error}</p>}
   <div className="shop-counters">
    {Object.entries({"Shop Stock PCS":num(summary.shopStockPcs),
     "Warehouse Transit PCS":num(summary.incomingTransitPcs),
     "Paid Invoices":num(summary.invoiceCount),
     "Net Sales (INR)":money(summary.netSalesPaise),
     "Net Margin":summary.recognizedMarginPaise===null?"Unavailable":money(summary.recognizedMarginPaise),
     "Pending Return Requests":num(summary.openReturnRequests)})
     .map(([name,value])=><div className="classic-card" key={name}>
      <small>{name}</small><h3>{value}</h3></div>)}
   </div>
   <div className="classic-card">
    <label>Search shop / SKU / carton / invoice / payment
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search live Shop data"/>
    </label>
    {["sales","margin"].includes(mode)?<Grid
      headers={["Shop","Invoices","Net Sold PCS","Net Sales","Gross Sales","COGS","Net Margin","Stock PCS"]}
      rows={filtered.shopSales.map(x=>[x.shop,x.invoices,num(x.soldNetPcs),money(x.netSalesPaise),
       money(x.grossSalesPaise),x.cogsComplete?money(x.cogsPaise):"Unavailable",
       x.marginPaise===null?"Unavailable":money(x.marginPaise),num(x.stockPcs)])}/>:
    mode==="stock"||mode==="issues"?<Grid headers={["Shop","SKU","Colour","Size","Available PCS","Bundles"]}
      rows={filtered.stockBySku.map(x=>[x.shop,x.sku,x.colour,x.size,num(x.quantity),x.bundles])}/>:
    ["receipt","receipts"].includes(mode)?<Grid headers={["Shop","Carton","Sent","Received","Pending","Status","ERP Document"]}
      rows={filtered.receipts.map(x=>[x.shop,x.bundleNo,num(x.sentPcs),num(x.receivedPcs),num(x.pendingPcs),x.status,x.documentId])}/>:
    ["return","returns"].includes(mode)?<Grid headers={["Invoice","Shop","SKU","Qty Requested","Reason","Category","Status"]}
      rows={filtered.requests.map(x=>[x.invoice,x.shop,x.sku,num(x.quantity),x.reason,x.kind,x.status])}/>:
    mode==="transfer"?<Grid headers={["Date","Destination","Stage","Carton","PCS","Document"]}
      rows={filtered.transfers.map(x=>[x.date?new Date(x.date).toLocaleString("en-IN"):"",
       x.destination,x.nextStage,x.bundleNo,num(x.quantity),x.documentId])}/>:
    mode==="count"?<Grid headers={["Shop","Bundle","SKU","Available PCS","Stage"]}
      rows={filtered.stock.map(x=>[x.shop,x.bundleNo,x.sku,num(x.quantity),x.stage])}/>:
    ["pos","outward"].includes(mode)?<Grid headers={["Shop","Bundle","SKU","Size","Colour","Available PCS"]}
      rows={filtered.stock.map(x=>[x.shop,x.bundleNo,x.sku,x.size,x.colour,num(x.quantity)])}/>:
    receiptSale?<Grid headers={["Invoice","Shop","SKU","PCS","Returned","Net Paid","Payment","Net Margin"]}
      rows={filtered.invoices.map(x=>[x.number,x.shop,x.sku,num(x.quantity),num(x.returnedPcs),
       money(x.grossPaise),x.paymentMode,x.marginPaise===null?"Unavailable":money(x.marginPaise)])}/>:
    <Grid headers={["Shop","Carton","SKU","Size","Colour","In Transit PCS"]}
      rows={filtered.incoming.map(x=>[x.shop,x.bundleNo,x.sku,x.size,x.colour,num(x.quantity)])}/>}
   </div>
   {mode==="pos"&&!readonly&&<>
    <div className="classic-card">
     <h3>Online POS / Customer Sale</h3>
     <p>One receipt per saved ERP sale. Immediate Cash or Bank only; no credit sale or separate outstanding balance collection.</p>
     <form className="form-grid" onSubmit={e=>run(e,"pos",key=>createShopSale({
      key,bundleId,quantity:Number(quantity),unitPrice:Number(unitPrice),
      discount:Number(discount),taxPercent:Number(taxPercent),taxType,paymentMode,
      customerName:customer,customerPhone:phone,customerGstin:gstin
     }),result=>{setBundleId("");setQuantity("");setInvoiceId(String(result?.details?.sale?._id||""));})}>
      <label>Shop Stock Bundle<select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setQuantity("");}}>
       <option value="">Select active Shop stock</option>
       {stockForPos.map(x=><option key={x.id} value={x.id}>{x.bundleNo} · {x.shop} · {x.sku} · {num(x.quantity)} PCS</option>)}
      </select></label>
      <label>Pieces<input type="number" min="1" step="1" max={selected?.quantity||undefined}
       required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      <label>Unit Price INR<input type="number" required min="0" step="0.01" value={unitPrice}
       onChange={e=>setUnitPrice(e.target.value)}/></label>
      <label>Discount INR<input type="number" min="0" step="0.01" value={discount}
       onChange={e=>setDiscount(e.target.value)}/></label>
      <label>GST %<select value={taxPercent} onChange={e=>setTaxPercent(e.target.value)}>
       {["0","5","12","18","28"].map(x=><option key={x} value={x}>{x}%</option>)}
      </select></label>
      <label>Tax Type<select value={taxType} onChange={e=>setTaxType(e.target.value)}>
       {["NO_TAX","CGST_SGST","IGST"].map(x=><option key={x} value={x}>{x}</option>)}
      </select></label>
      <label>Payment<select value={paymentMode} onChange={e=>setPaymentMode(e.target.value)}>
       <option value="CASH">Cash</option><option value="BANK">Bank</option>
      </select></label>
      <label>Customer Name<input maxLength={120} value={customer} onChange={e=>setCustomer(e.target.value)}/></label>
      <label>Phone<input maxLength={25} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <label>Customer GSTIN<input maxLength={20} value={gstin} onChange={e=>setGstin(e.target.value.toUpperCase())}/></label>
      <button className="primary" disabled={busy||!validQty||unitPrice===""}>
       <Save size={16}/> Post Sale & Collect Payment</button>
     </form>
    </div>
    <div className="classic-card"><h3>Offline cash-sale drafts</h3>
     <p>Existing offline POS saves device drafts and posts a real sale only after authenticated online sync.</p>
     <OfflinePos user={user} bundles={(data.stock||[]).map(b=>({
      _id:b.id,code:b.bundleNo,qty:b.quantity,stage:b.stage,destination:b.shop
     }))} onSynced={load} onInvoice={s=>{if(s?._id)setInvoiceId(String(s._id));}}/>
    </div>
   </>}
   {mode==="receipt"&&!readonly&&<div className="classic-card">
    <h3>Warehouse → Shop Physical Receipt</h3>
    <p>Confirm only goods physically received. Partial receipt posts one ERP transfer from TRANSIT_SHOP to SHOP stock.</p>
    <form className="form-grid" onSubmit={e=>run(e,"receipt",key=>receiveShopTransit({
     bundleId,quantity:Number(quantity),key
    }),()=>{setBundleId("");setQuantity("");})}>
     <label>Inbound bundle<select value={bundleId} required onChange={e=>{setBundleId(e.target.value);setQuantity("");}}>
      <option value="">Choose Shop-bound in-transit bundle</option>
      {filtered.incoming.map(x=><option key={x.id} value={x.id}>
       {x.bundleNo} · {x.shop} · {x.sku} · {num(x.quantity)} PCS</option>)}
     </select></label>
     <label>Physically Received PCS<input required type="number" min="1" step="1"
      max={selected?.quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <button disabled={busy||!validQty||!selected?.stage?.startsWith("TRANSIT_SHOP:")} className="primary">
      <Save size={16}/> Confirm Shop Receipt</button>
    </form>
   </div>}
   {mode==="transfer"&&!readonly&&<div className="classic-card">
    <h3>Shop Stock Transfer — dispatch to transit</h3>
    <p>Moves SHOP stock into transit. Destination Shop or Warehouse performs a separate receipt.</p>
    <form className="form-grid" onSubmit={e=>run(e,"transfer",key=>transferShopStock({
      bundleId,quantity:Number(quantity),destination:target,key
    }),()=>{setBundleId("");setQuantity("");setTarget("");})}>
     <label>Source Shop Bundle<select required value={bundleId} onChange={e=>setBundleId(e.target.value)}>
      <option value="">Choose available stock</option>
      {filtered.stock.map(x=><option key={x.id} value={x.id}>
       {x.bundleNo} · {x.shop} · {num(x.quantity)} PCS</option>)}
     </select></label>
     <label>Destination Shop / Warehouse Key<input required maxLength={60} value={target}
      onChange={e=>setTarget(e.target.value.toUpperCase())}/></label>
     <label>Pieces<input type="number" required step="1" min="1"
      max={selected?.quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <button type="submit" className="primary" disabled={busy||!validQty||!target}>
      <Save size={16}/> Post Transfer</button>
    </form>
   </div>}
   {mode==="return"&&!readonly&&<div className="classic-card">
    <h3>Customer Return — Non-posting Review Request</h3>
    <p>Submitting does NOT refund payment or alter stock. A separate reviewed ERP return posts a real refund and moves pieces to CHECKING.</p>
    <form className="form-grid" onSubmit={e=>run(e,"return",key=>requestCustomerReturn({
      key,saleId:invoiceId,quantity:Number(quantity),kind,reason
    }),()=>{setQuantity("");setReason("");})}>
     <label>Posted Invoice<select required value={invoiceId} onChange={e=>{setInvoiceId(e.target.value);setQuantity("");}}>
      <option value="">Select invoice with unreturned pieces</option>
      {filtered.invoices.filter(x=>x.quantity>x.returnedPcs).map(x=>
       <option key={x.id} value={x.id}>{x.number} · {x.shop} · {num(x.quantity-x.returnedPcs)} returnable PCS</option>)}
     </select></label>
     <label>Return Request PCS<input required type="number" min="1" step="1"
      max={selectedSale?.quantity-selectedSale?.returnedPcs||undefined}
      value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Reason Category<select value={kind} onChange={e=>setKind(e.target.value)}>
      {["QUALITY","SIZE","DEFECT","CUSTOMER_OTHER"].map(x=><option key={x} value={x}>{x}</option>)}
     </select></label>
     <label>Details (8–300 chars)<input required minLength={8} maxLength={300}
      value={reason} onChange={e=>setReason(e.target.value)}/></label>
     <button className="primary" disabled={busy||!invoiceId}><Save size={16}/> Submit Review Request</button>
    </form>
   </div>}
   {mode==="count"&&!readonly&&<div className="classic-card">
    <h3>Shop Physical Stock Count</h3>
    <p>Only shortages/damage create a pending request. Independent company Admin decides; excess stock needs reviewed receipt.</p>
    <form className="form-grid" onSubmit={e=>{
      if(selected&&Number(counted)===selected.quantity){
       e.preventDefault();notify?.("Physical count matches ERP stock — no adjustment needed");return;
      }
      return run(e,"count",key=>requestShopStockCount({
       key,bundleId,countedQty:Number(counted),kind:difference,reason
      }),()=>{setBundleId("");setCounted("");setReason("");});
     }}>
     <label>Shop Bundle<select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setCounted("");}}>
      <option value="">Select live stock</option>{filtered.stock.map(x=>
       <option key={x.id} value={x.id}>{x.bundleNo} · {x.shop} · {num(x.quantity)} PCS</option>)}
     </select></label>
     <label>Counted good PCS<input required type="number" min="0" step="1"
      max={selected?.quantity||undefined} value={counted} onChange={e=>setCounted(e.target.value)}/></label>
     <label>Difference<select value={difference} onChange={e=>setDifference(e.target.value)}>
      <option value="MISSING">Missing</option><option value="DAMAGED">Damaged</option>
     </select></label>
     <label>Count Reason<input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
     <button disabled={busy||!selected||counted===""||!Number.isSafeInteger(Number(counted))||
      Number(counted)<0||Number(counted)>selected.quantity} className="primary">
      <Save size={16}/> Submit Count Review</button>
    </form>
   </div>}
   {mode==="payment"&&<p>Payment collection is recorded with the posted online POS sale (CASH or BANK). Outstanding credit, instalments, partial/advance receipts and payment gateway integration are not yet implemented.</p>}
   {mode==="returns"&&<p>Customer returns shown here are review requests. Posted refunds are reflected in invoice returned quantities and net sales; a request alone has no refund or stock impact.</p>}
   {mode==="issues"&&<p>Shop stock variances require Admin stock exception approval; current report shows live stock, while detailed adjustment decisions are available to authorized Company Admin in ERP.</p>}
   {mode==="pos"&&<p>Tax/discount totals are validated by the server. Offline drafts are provisional and not revenue until synced.</p>}
   {displayInvoice&&<div className="classic-card">
    <h3>Select Posted Invoice</h3>
    <select value={invoiceId} onChange={e=>setInvoiceId(e.target.value)}>
     <option value="">Choose invoice to print</option>
     {filtered.invoices.map(x=><option key={x.id} value={x.id}>{x.number} · {x.shop} · {money(x.invoiceGrossPaise)}</option>)}
    </select>
    <p>Preview uses ERP posted sale and supplier details. Before statutory use, verify mandatory GST invoice fields and numbering with your accountant.</p>
   </div>}
   {mode==="history"&&<div className="classic-card">
    <h3>Authenticated Bundle / Invoice Trace</h3>
    <label>Stock QR <select value={trace} onChange={e=>setTrace(e.target.value)}>
     <option value="">Choose live bundle</option>{filtered.stock.map(x=>
      <option key={x.id} value={x.id}>{x.bundleNo} · {x.shop}</option>)}
    </select></label>
    {trace&&<BundleTrace bundleId={trace} onClose={()=>setTrace("")}/>}
   </div>}
  </div>
  {displayInvoice&&selectedSale&&<div className="shop-receipt">
   <h3>UG SaaS · Posted Retail Sales Invoice</h3>
   <p><strong>{selectedSale.supplier?.name||"Company"}</strong> · {selectedSale.supplier?.address||""}</p>
   <p>Supplier GSTIN: {selectedSale.supplier?.gstin||"Not recorded"}</p>
   <p>Invoice: <strong>{selectedSale.number}</strong> ·
    {selectedSale.createdAt?new Date(selectedSale.createdAt).toLocaleString("en-IN"):""} · Shop: {selectedSale.shop}</p>
   <p>Customer: {selectedSale.customer?.name||"Walk-in"}
    {selectedSale.customer?.gstin?" · GSTIN: "+selectedSale.customer.gstin:""}</p>
   <table><thead><tr><th>SKU</th><th>PCS</th><th>Net INR</th><th>Tax INR</th><th>Gross INR</th></tr></thead>
    <tbody><tr><td>{selectedSale.sku}</td><td>{num(selectedSale.quantity)}</td>
     <td>{money(selectedSale.invoiceNetPaise)}</td><td>{money(selectedSale.invoiceTaxPaise)}</td>
     <td>{money(selectedSale.invoiceGrossPaise)}</td></tr></tbody>
   </table>
   <p>Payment recorded: {selectedSale.paymentMode} · Tax type: {selectedSale.taxType} · Tax rate: {selectedSale.taxPercent}%</p>
   <p>Returned PCS: {num(selectedSale.returnedPcs)} · Refund issued: {money(selectedSale.refundPaise)}</p>
   <small>Posted ERP record {selectedSale.documentId}. Tax format and jurisdictional compliance require separate verification.</small>
  </div>}
  <small className="shop-not-receipt">Sales amounts exclude posted refunds; stock and transit quantities are distinct. Margin is unavailable if any underlying posted COGS journal is missing.</small>
 </section>;
}
