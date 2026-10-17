// Shop dashboard derives from existing ERP stock, RetailSale and posted
// stock/finance journal documents. Amounts are stored in integer paise.
import ApiError from "../utils/ApiError.js";
const pcs=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const pennies=v=>Number.isSafeInteger(v)?v:0;
const str=v=>String(v??"").trim();
const inStock=s=>str(s).startsWith("SHOP:");
const inTransit=s=>str(s).startsWith("TRANSIT_SHOP:");
export function validateShopReturnRequest(input={},sale={},pending=[]){
 const quantity=Number(input.quantity),reason=str(input.reason),
  kind=str(input.kind||"QUALITY").toUpperCase();
 if(!["QUALITY","SIZE","DEFECT","CUSTOMER_OTHER"].includes(kind))
  throw new ApiError(400,"Select a valid return reason category");
 if(!Number.isSafeInteger(quantity)||quantity<=0||input.quantity==null||
  input.quantity===""||typeof input.quantity==="boolean")
  throw new ApiError(400,"Return request requires whole positive PCS");
 const outstanding=pcs(sale.quantity)-pcs(sale.returned);
 if(quantity>outstanding)throw new ApiError(409,"Return exceeds unreturned invoice pieces");
 if(reason.length<8||reason.length>300)throw new ApiError(400,"Explain return in 8–300 characters");
 // Requests do not reserve/refund inventory. Surface existing pending requests
 // to operator to prevent accidental duplication, without auto-rejecting.
 return {quantity,kind,reason,unreturnedPcs:outstanding,
  otherPendingPcs:pending.filter(r=>r.status==="PENDING").reduce((sum,r)=>sum+pcs(r.quantity),0)};
}
export function shopOverview(lots=[],bundles=[],sales=[],events=[],documents=[],masters=[],requests=[],skus=[],now=new Date()){
 const byLot=new Map(lots.map(l=>[String(l._id),l])),bySku=new Map(skus.map(s=>[s.code,s]));
 const shops=masters.filter(m=>m.kind==="SHOP"&&m.active!==false).map(m=>({
  key:m.key,name:m.name||m.key,address:m.address||"",contact:m.contact||""}));
 const allowed=new Set(shops.map(s=>s.key));
 const summary={shopStockPcs:0,incomingTransitPcs:0,shopBundles:0,
  invoiceCount:0,grossSalesPaise:0,netSalesPaise:0,
  salesTaxPaise:0,returnedPcs:0,returnedRefundPaise:0,
  recognizedMarginPaise:null,openReturnRequests:requests.filter(r=>r.status==="PENDING").length,
  invoiceCogsMissing:0};
 const stock=[],byStock=new Map(),incoming=[];
 for(const b of bundles){
  const loc=str(b.destination),qty=pcs(b.qty),lot=byLot.get(String(b.lotId));
  if(!allowed.has(loc)||!lot||!qty||(!inStock(b.stage)&&!inTransit(b.stage)))continue;
  const sku=bySku.get(lot.sku)||{};
  const timestamp=b.createdAt?new Date(b.createdAt):null;
  const ageHours=timestamp&&Number.isFinite(timestamp.valueOf())?
   Math.floor(Math.max(0,(now-timestamp)/3600000)):null;
  const row={id:String(b._id),bundleNo:b.code||"",lotNo:lot.code||"",dcNo:lot.dcNo||"",
   orderNo:lot.orderNo||"",shop:loc,sku:lot.sku||"",colour:sku.colour||"",size:sku.size||"",
   stage:b.stage,quantity:qty,parentId:b.parentId||"",ageHours};
  if(inStock(b.stage)){
   stock.push(row);summary.shopStockPcs+=qty;summary.shopBundles++;
   const k=JSON.stringify([loc,row.sku]),g=byStock.get(k)||{
    shop:loc,sku:row.sku,colour:row.colour,size:row.size,quantity:0,bundles:0};
   g.quantity+=qty;g.bundles++;byStock.set(k,g);
  }else{incoming.push(row);summary.incomingTransitPcs+=qty;}
 }
 const docs=new Map(documents.map(d=>[String(d._id),d]));
 const refunds=new Map(),returnHistory=[];
 for(const e of events){
  if(e.reversedBy||e.kind!=="RETURN"||e.department!=="SHOP")continue;
  const saleId=str(e.details?.saleId),x=refunds.get(saleId)||{
   refundedNetPaise:0,refundedTaxPaise:0,refundedGrossPaise:0,
   refundedCostPaise:0,returnedPcs:0};
  x.refundedNetPaise+=pennies(e.details?.refund?.net);
  x.refundedTaxPaise+=pennies(e.details?.refund?.tax);
  x.refundedGrossPaise+=pennies(e.details?.refund?.gross);
  x.refundedCostPaise+=pennies(e.details?.cost);x.returnedPcs+=pcs(e.quantity);
  refunds.set(saleId,x);
  returnHistory.push({id:String(e._id),date:e.createdAt||null,saleId,
    quantity:pcs(e.quantity),refundPaise:pennies(e.details?.refund?.gross),
    reason:e.details?.reason||"",documentId:e.documentId||""});
 }
 const invoices=[],byShop=new Map();
 for(const s of sales){
  if(!allowed.has(s.shop))continue;
  const document=docs.get(String(s.documentId));
  const cogsLine=document?.journals?.find(j=>j.account==="COGS"&&j.debit>0);
  const refund=refunds.get(String(s._id))||{};
  const netPaise=pennies(s.totals?.net)-pennies(refund.refundedNetPaise),
   taxPaise=pennies(s.totals?.tax)-pennies(refund.refundedTaxPaise),
   grossPaise=pennies(s.totals?.gross)-pennies(refund.refundedGrossPaise);
  const cost=cogsLine?Math.max(0,pennies(cogsLine.debit)-pennies(refund.refundedCostPaise)):null;
  const row={id:String(s._id),number:s.number||"",shop:s.shop,sku:s.sku,
   createdAt:s.createdAt||null,quantity:pcs(s.quantity),
   returnedPcs:pcs(s.returned),soldNetPcs:pcs(s.quantity)-pcs(s.returned),
   grossPaise,netPaise,taxPaise,refundPaise:pennies(refund.refundedGrossPaise),
   invoiceNetPaise:pennies(s.totals?.net),invoiceTaxPaise:pennies(s.totals?.tax),
   invoiceGrossPaise:pennies(s.totals?.gross),
   cogsPaise:cost,marginPaise:cost===null?null:netPaise-cost,
   paymentMode:s.paymentMode||"",taxType:s.taxType||"",
   taxPercent:s.taxPercent||0,documentId:s.documentId||"",
   customer:s.customer||{},supplier:s.supplier||{}};
  invoices.push(row);summary.invoiceCount++;
  summary.grossSalesPaise+=grossPaise;summary.netSalesPaise+=netPaise;
  summary.salesTaxPaise+=taxPaise;summary.returnedPcs+=pcs(s.returned);
  summary.returnedRefundPaise+=row.refundPaise;
  if(cost===null)summary.invoiceCogsMissing++;
  const g=byShop.get(s.shop)||{shop:s.shop,invoices:0,netSalesPaise:0,
   grossSalesPaise:0,cogsPaise:0,marginPaise:0,cogsComplete:true,soldNetPcs:0};
  g.invoices++;g.netSalesPaise+=netPaise;g.grossSalesPaise+=grossPaise;
  g.soldNetPcs+=row.soldNetPcs;
  if(cost===null)g.cogsComplete=false;else{g.cogsPaise+=cost;g.marginPaise+=netPaise-cost;}
  byShop.set(s.shop,g);
 }
 if(summary.invoiceCogsMissing===0)
  summary.recognizedMarginPaise=[...byShop.values()].reduce((v,x)=>v+x.marginPaise,0);
 const transfers=[],receiptRows=[];
 const receiptQty=new Map();
 for(const e of events){
  if(e.kind!=="TRANSFER"||e.department!=="SHOP"||e.reversedBy)continue;
  const b=e.details?.bundle;
  if(!inStock(b?.stage)||!allowed.has(b?.destination))continue;
  const parentId=str(b?.parentId);
  receiptQty.set(parentId,(receiptQty.get(parentId)||0)+pcs(e.quantity));
 }
 for(const e of events){
  if(e.kind!=="TRANSFER"||e.reversedBy)continue;
  const b=e.details?.bundle,stage=str(b?.stage),dest=str(b?.destination);
  if(inTransit(stage)&&e.department==="WAREHOUSE"&&allowed.has(dest)){
   const sent=pcs(e.quantity),received=Math.min(sent,receiptQty.get(String(b._id))||0);
   receiptRows.push({id:String(e._id),date:e.createdAt||null,bundleNo:b.code||"",
    transitId:String(b._id),shop:dest,sentPcs:sent,receivedPcs:received,
    pendingPcs:Math.max(0,sent-received),
    status:received===0?"IN_TRANSIT":received===sent?"RECEIVED":"PARTIAL_RECEIPT",
    documentId:e.documentId||""});
  }
  // SHOP transfer includes source bundle and new destination in event.
  if(e.department==="SHOP"&&["TRANSIT_SHOP:","TRANSIT_WAREHOUSE"].some(x=>stage.startsWith(x)))
   transfers.push({id:String(e._id),date:e.createdAt||null,shop:dest,
    destination:dest,nextStage:stage,bundleNo:b?.code||"",quantity:pcs(e.quantity),
    sourceBundleId:e.bundleId||"",documentId:e.documentId||""});
 }
 const stockByShop=new Map();
 for(const row of byStock.values())stockByShop.set(row.shop,(stockByShop.get(row.shop)||0)+row.quantity);
 const shopSales=[...byShop.values()].map(g=>({...g,
  marginPaise:g.cogsComplete?g.marginPaise:null,stockPcs:stockByShop.get(g.shop)||0}));
 const visibleRequests=requests.filter(r=>allowed.has(r.shop)).map(r=>({
  id:String(r._id),saleId:r.saleId,invoice:r.invoice||"",
  shop:r.shop,sku:r.sku||"",quantity:pcs(r.quantity),kind:r.kind,reason:r.reason,
  status:r.status,unreturnedAtRequest:pcs(r.unreturnedAtRequest),
  requestedBy:r.requestedBy||"",createdAt:r.createdAt||null
 }));
 return {summary,shops,stock,stockBySku:[...byStock.values()],incoming,
  receipts:receiptRows,invoices,returns:returnHistory,requests:visibleRequests,
  transfers,shopSales,notes:{
   margin:"Net sales less posted COGS, after posted refunds; unavailable when journal missing",
   payment:"Only paid CASH/BANK invoices; no receivables/partial collections",
   returns:"Return request does not refund or restock goods; posted return goes to CHECKING",
   stock:"Live Shop stock and pending transit are separate"}};
}
