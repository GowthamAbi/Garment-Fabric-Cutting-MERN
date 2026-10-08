import {Router} from 'express';
import mongoose from 'mongoose';
import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Company from '../models/Company.js';
import {workspaceFilter,requestHash} from './service.js';
import {ErpSettings,ErpSku,ErpBalance,ErpDocument,ErpEntry,ErpSequence} from './models.js';
import {DepartmentMaster as Master,DepartmentLot as Lot,DepartmentBundle as Bundle,DepartmentEvent as Event,RetailSale as Sale,DepartmentDemand as Demand,DEPARTMENT_MODELS} from './departmentModels.js';
import {DEPARTMENTS,allowedShop,allowedDepartment,enabledDepartment,pieces,names,checkSplit,stageAfter,packingRequirements,saleTotals,demandSuggestion} from './departmentPolicy.js';
import {fail,ratio,safeInteger} from './policy.js';
const router=Router();
const clean=v=>String(v||'').trim().slice(0,120);
const deptFor=stage=>stage.startsWith('OP:')||['STITCHING_READY','STITCHED','REWORK','REWORK_DONE'].includes(stage)?'STITCHING':['OIL','OIL_DONE','CHECKING','GOOD','WASTE'].includes(stage)?'CHECKING':['IRONING','IRONED'].includes(stage)?'IRONING':stage==='PACKED'?'DISPATCH':stage==='TRANSIT_WAREHOUSE'?'DISPATCH':stage.startsWith('WAREHOUSE:')||stage.startsWith('TRANSIT_SHOP:')?'WAREHOUSE':'SHOP';
function location(b){return `DPT:${b.stage}:${b.code}`;}
function shopAccess(req,code){if(!allowedShop(req.user,code))throw new ApiError(403,'Assigned shop permission required');}
function requireAccess(req,department,write=true){if(!DEPARTMENTS.includes(department)||!allowedDepartment(req.user,department,write)||!enabledDepartment(req.departmentCompany,department))throw new ApiError(403,`${department} department permission/subscription required`);if(write)req.departmentWrite=department;}
router.use(asyncHandler(async(req,_res,next)=>{req.departmentCompany=await Company.findById(workspaceFilter().companyId).lean();if(!req.departmentCompany)fail('Company not found');next();}));
async function transaction(req,kind,fn){
 const scope=workspaceFilter(),key=clean(req.body.key);if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))fail('A 16–100 character idempotency key is required');
 const hash=requestHash({kind,...req.body});await Promise.all([...DEPARTMENT_MODELS,ErpBalance,ErpEntry,ErpDocument,ErpSequence].map(m=>m.init()));
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const lock=await ErpSettings.findOneAndUpdate({...scope,key:'ERP',enabled:true},{$inc:{revision:1}},{new:true,session});if(!lock)fail('ERP activation required');
  const old=await Event.findOne({...scope,key}).session(session);if(old){requireAccess(req,old.department);if(old.requestHash!==hash)fail('Retry key has different contents');result=old;return;}
  const details=await fn(scope,session);[result]=await Event.create([{...scope,key,requestHash:hash,kind,department:req.departmentWrite,actor:req.user.userId,...details}],{session});
 });return result;}finally{await session.endSession();}
}
async function sequence(scope,session,prefix){const s=await ErpSequence.findOneAndUpdate({...scope,key:`DPT:${prefix}`},{$inc:{value:1}},{upsert:true,new:true,session});return `${prefix}-${new Date().getUTCFullYear()}-${String(s.value).padStart(7,'0')}`;}
async function getBundle(id,scope,session){if(!mongoose.isValidObjectId(id))fail('Invalid bundle');const b=await Bundle.findOne({...scope,_id:id}).session(session);if(!b||b.qty<=0)fail('Bundle is empty or unavailable');return b;}
async function newBundle(scope,session,lot,qty,stage,parent='',destination='',cycle=0){const [b]=await Bundle.create([{...scope,code:await sequence(scope,session,'BND'),lotId:String(lot._id),parentId:parent,qty,stage,destination,cycle}],{session});return b;}
async function journalMove(scope,session,req,moves,journals=[],totals={net:0,tax:0,gross:0},type='DEPARTMENT_MOVEMENT'){
 const id=new mongoose.Types.ObjectId(),number=await sequence(scope,session,'DEP'),date=new Date(),posted=[];
 for(const m of moves){const key=`${m.sku}@${m.location}`;let b=await ErpBalance.findOne({...scope,key}).session(session);if(!b){[b]=await ErpBalance.create([{...scope,key,sku:m.sku,location:m.location,qty:0,value:0}],{session});}
  const nextQty=b.qty+m.delta,nextValue=b.value+m.value;safeInteger(nextQty);safeInteger(nextValue);b.qty=nextQty;b.value=nextValue;await b.save({session});posted.push({...m,qtyAfter:b.qty,valueAfter:b.value});
  await ErpEntry.create([{...scope,documentId:id,documentNo:number,date,kind:'STOCK',key,sku:m.sku,location:m.location,delta:m.delta,value:m.value,qtyAfter:b.qty,valueAfter:b.value}],{session});
 }
 if(journals.reduce((n,j)=>n+j.debit-j.credit,0)!==0)fail('Unbalanced journal');
 for(const j of journals)await ErpEntry.create([{...scope,documentId:id,documentNo:number,date,kind:'JOURNAL',...j}],{session});
 await ErpDocument.create([{...scope,_id:id,number,type,date,idempotencyKey:`department_${req.body.key}_${number}`,requestHash:requestHash(req.body),lines:[],moves:posted,journals,totals,metadata:{departmentManaged:true,departmentEventKey:req.body.key},postedBy:req.user.userId,notes:clean(req.body.notes)}],{session});return String(id);
}
async function take(scope,session,sku,from,count){const qty=count*1000,b=await ErpBalance.findOne({...scope,key:`${sku}@${from}`}).session(session);if(!b||b.qty<qty)fail('Insufficient source stock');const value=qty===b.qty?b.value:ratio(b.value,qty,b.qty);return {sku,location:from,delta:-qty,value:-value};}
async function moveBundle(req,scope,session,b,count,next,destination=''){
 if(count>b.qty)fail('Quantity exceeds bundle');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session);if(!lot)fail('Lot not found');
 const out=await take(scope,session,lot.sku,location(b),count),child=await newBundle(scope,session,lot,count,next,String(b._id),destination,b.cycle+(next==='CHECKING'?1:0));
 b.qty-=count;await b.save({session});const documentId=await journalMove(scope,session,req,[out,{sku:lot.sku,location:location(child),delta:count*1000,value:-out.value}]);return {child,documentId,lot};
}
router.get('/catalog',asyncHandler(async(req,res)=>res.json({departments:DEPARTMENTS.filter(d=>allowedDepartment(req.user,d,false)&&enabledDepartment(req.departmentCompany,d)),writeDepartments:DEPARTMENTS.filter(d=>allowedDepartment(req.user,d,true)&&enabledDepartment(req.departmentCompany,d))})));
router.get('/:department/dashboard',asyncHandler(async(req,res)=>{
 const d=req.params.department;requireAccess(req,d,false);const scope=workspaceFilter();
 const [bundles,lots,masters,sales]=await Promise.all([Bundle.find({...scope,qty:{$gt:0}}).limit(10001).lean(),Lot.find({...scope,status:{$ne:'CANCELLED'}}).sort({_id:-1}).limit(2000).lean(),Master.find(scope).limit(2000).lean(),d==='MARKETING'||d==='SHOP'?Sale.find(scope).sort({_id:-1}).limit(2000).lean():[]]);
 if(bundles.length>10000)fail('Bundle report limit exceeded; archive/export history');
 res.json({bundles:bundles.filter(b=>(d!=='SHOP'||allowedShop(req.user,b.destination))&&(deptFor(b.stage)===d||(d==='PACKING'&&b.stage==='IRONED')||(d==='WAREHOUSE'&&b.stage==='TRANSIT_WAREHOUSE')||(d==='SHOP'&&b.stage.startsWith('TRANSIT_SHOP:'))||(d==='INWARD'&&['STITCHED','REWORK_DONE'].includes(b.stage)))),lots:['STITCHING','INWARD'].includes(d)?lots:[],masters:masters.filter(m=>d==='PACKING'?m.kind==='PACKING':d==='STITCHING'?m.kind==='STITCHING':d==='SHOP'?m.kind===d&&allowedShop(req.user,m.key):d==='WAREHOUSE'?m.kind===d:false),sales:d==='SHOP'?sales.filter(s=>allowedShop(req.user,s.shop)):[],department:d});
}));
router.post('/masters',asyncHandler(async(req,res)=>{
 const kind=req.body.kind;requireAccess(req,kind);const scope=workspaceFilter(),sku=clean(req.body.sku).toUpperCase(),key=clean(req.body.masterKey);if(!/^[A-Za-z0-9_-]{2,60}$/.test(key))fail('Master key must be 2–60 letters/numbers/underscore/hyphen');
 if(['STITCHING','PACKING'].includes(kind)&&!await ErpSku.exists({...scope,code:sku,kind:'FINISHED',unit:{$in:['PCS','PC','PIECE','PIECES']}}))fail('A finished piece SKU is required');
 const operations=kind==='STITCHING'?names(req.body.operations||String(req.body.operationText||'').split(',')):[],materials=kind==='PACKING'?req.body.materials:[];
 if(kind==='PACKING'){packingRequirements(materials,1);if(new Set(materials.map(m=>m.sku)).size!==materials.length)fail('Duplicate packing material');for(const m of materials)if(!await ErpSku.exists({...scope,code:m.sku,kind:{$in:['RAW','CONSUMABLE']}}))fail('Packing material SKU not found');}
 if(!['STITCHING','PACKING','WAREHOUSE','SHOP'].includes(kind))fail('Unsupported master');
 res.json(await transaction(req,'MASTER',async(s,session)=>{if(await Master.exists({...s,key}).session(session))fail('Use a new master version/key');const [m]=await Master.create([{...s,key,kind,sku,name:clean(req.body.name)||key,operations,materials}],{session});return {details:{master:m}};}));
}));
router.post('/delivery',asyncHandler(async(req,res)=>{
 requireAccess(req,'STITCHING');res.json(await transaction(req,'DELIVERY',async(scope,session)=>{
  const sku=clean(req.body.sku).toUpperCase(),qty=pieces(req.body.quantity),sourceLocation=req.body.sourceLocation;
  if(!['CUTTING','FINISHED'].includes(sourceLocation))fail('Use reviewed CUTTING or FINISHED core stock');
  const master=await Master.findOne({...scope,key:req.body.operationMaster,kind:'STITCHING',sku}).session(session);if(!master)fail('Stitching master required');
  const packing=await Master.findOne({...scope,key:req.body.packingMaster,kind:'PACKING',sku}).session(session);if(!packing)fail('Packing master required');
  if(!clean(req.body.dcNo)||!clean(req.body.orderNo)||!clean(req.body.section))fail('Order, DC and section required');
  const [lot]=await Lot.create([{...scope,code:await sequence(scope,session,'LOT'),sku,sent:qty,dcNo:clean(req.body.dcNo),orderNo:clean(req.body.orderNo),section:clean(req.body.section),sourceLocation,operations:master.operations,packing:packing.materials,createdBy:req.user.userId}],{session});
  const b=await newBundle(scope,session,lot,qty,'STITCHING_READY'),out=await take(scope,session,sku,sourceLocation,qty);
  const documentId=await journalMove(scope,session,req,[out,{sku,location:location(b),delta:qty*1000,value:-out.value}]);return {lotId:String(lot._id),bundleId:String(b._id),quantity:qty,documentId,details:{bundle:b}};
 }));
}));
router.post('/advance',asyncHandler(async(req,res)=>res.json(await transaction(req,'ADVANCE',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session);requireAccess(req,['STITCHED','REWORK_DONE'].includes(b.stage)?'INWARD':deptFor(b.stage));
 const count=pieces(req.body.quantity),lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),next=stageAfter(b.stage,lot.operations);
 if(next==='PACKED')fail('Use packing entry to consume materials');const moved=await moveBundle(req,scope,session,b,count,next);
 if(b.stage==='STITCHED'){lot.received+=count;if(lot.received>lot.sent)fail('Original inward exceeds DC');await lot.save({session});}
 return {bundleId:String(b._id),lotId:b.lotId,quantity:count,documentId:moved.documentId,details:{bundle:moved.child,operator:clean(req.body.operator),shift:clean(req.body.shift)}};
}))));
router.post('/check',asyncHandler(async(req,res)=>{requireAccess(req,'CHECKING');res.json(await transaction(req,'CHECK',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session);if(b.stage!=='CHECKING')fail('Receive into checking first');const split=checkSplit(req.body,b.qty),children=[];
 for(const [field,stage] of [['good','GOOD'],['rework','REWORK'],['oil','OIL'],['reject','WASTE']])if(split[field]){const moved=await moveBundle(req,scope,session,b,split[field],stage);children.push(moved.child);}
 return {bundleId:String(b._id),lotId:b.lotId,quantity:split.total,details:{split,children,defect:clean(req.body.defect)}};
 }));}));
router.post('/pack',asyncHandler(async(req,res)=>{requireAccess(req,'PACKING');res.json(await transaction(req,'PACK',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session);if(b.stage!=='IRONED')fail('Only ironed bundles can be packed');const count=pieces(req.body.quantity);if(count>b.qty)fail('Packing exceeds bundle');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),requirements=packingRequirements(lot.packing,count),moves=[],totalCost={value:0};
 for(const material of requirements){const m=await take(scope,session,material.sku,'ACCESSORIES',material.qty/1000);moves.push(m);totalCost.value+=-m.value;}
 const out=await take(scope,session,lot.sku,location(b),count),child=await newBundle(scope,session,lot,count,'PACKED',String(b._id));b.qty-=count;await b.save({session});
 moves.push(out,{sku:lot.sku,location:location(child),delta:count*1000,value:-out.value+totalCost.value});const documentId=await journalMove(scope,session,req,moves);return {bundleId:String(b._id),quantity:count,documentId,details:{carton:child,requirements}};
 }));}));
router.post('/transfer',asyncHandler(async(req,res)=>res.json(await transaction(req,'TRANSFER',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session),count=pieces(req.body.quantity);requireAccess(req,b.stage==='TRANSIT_WAREHOUSE'?'WAREHOUSE':b.stage.startsWith('TRANSIT_SHOP:')?'SHOP':deptFor(b.stage));let next,destination=b.destination;
 if(b.stage==='PACKED'){const w=await Master.findOne({...scope,key:req.body.destination,kind:'WAREHOUSE'}).session(session);if(!w)fail('Warehouse master required');destination=w.key;next='TRANSIT_WAREHOUSE';requireAccess(req,'DISPATCH');}
 else if(b.stage==='TRANSIT_WAREHOUSE'){requireAccess(req,'WAREHOUSE');next=`WAREHOUSE:${destination}`;}
 else if(b.stage.startsWith('WAREHOUSE:')){const shop=await Master.findOne({...scope,key:req.body.destination,kind:'SHOP'}).session(session);if(!shop)fail('Shop master required');destination=shop.key;next=`TRANSIT_SHOP:${destination}`;}
 else if(b.stage.startsWith('TRANSIT_SHOP:')){requireAccess(req,'SHOP');shopAccess(req,destination);next=`SHOP:${destination}`;}
 else if(b.stage.startsWith('SHOP:')){shopAccess(req,b.destination);const target=await Master.findOne({...scope,key:req.body.destination,kind:{$in:['SHOP','WAREHOUSE']}}).session(session);if(!target)fail('Shop or warehouse destination required');destination=target.key;next=target.kind==='SHOP'?`TRANSIT_SHOP:${destination}`:'TRANSIT_WAREHOUSE';}
 else fail('Unsupported transfer stage');
 const moved=await moveBundle(req,scope,session,b,count,next,destination);return {bundleId:String(b._id),quantity:count,documentId:moved.documentId,details:{bundle:moved.child}};
}))));
router.post('/split',asyncHandler(async(req,res)=>res.json(await transaction(req,'SPLIT',async(scope,session)=>{const b=await getBundle(req.body.bundleId,scope,session);requireAccess(req,deptFor(b.stage));const count=pieces(req.body.quantity);if(count>=b.qty)fail('Split must leave quantity in parent');const moved=await moveBundle(req,scope,session,b,count,b.stage,b.destination);return {bundleId:String(b._id),quantity:count,documentId:moved.documentId,details:{bundle:moved.child}};}))));
router.get('/trace/:id',asyncHandler(async(req,res)=>{const scope=workspaceFilter();if(!mongoose.isValidObjectId(req.params.id))fail('Invalid bundle');const b=await Bundle.findOne({...scope,_id:req.params.id}).lean();if(!b)fail('Bundle not found');requireAccess(req,b.stage==='IRONED'?'PACKING':b.stage==='STITCHED'||b.stage==='REWORK_DONE'?'INWARD':b.stage==='TRANSIT_WAREHOUSE'?'WAREHOUSE':b.stage.startsWith('TRANSIT_SHOP:')?'SHOP':deptFor(b.stage),false);const lot=await Lot.findOne({...scope,_id:b.lotId}).lean();const events=await Event.find({...scope,$or:[{bundleId:String(b._id)},{lotId:b.lotId}]}).sort({_id:-1}).limit(500).lean();if(b.stage.startsWith('SHOP:')||b.stage.startsWith('TRANSIT_SHOP:'))shopAccess(req,b.destination);res.json({bundle:b,lot,events:events.map(e=>({createdAt:e.createdAt,kind:e.kind,quantity:e.quantity,actor:e.actor}))});}));
router.post('/sale',asyncHandler(async(req,res)=>{requireAccess(req,'SHOP');res.json(await transaction(req,'SALE',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session);if(!b.stage.startsWith('SHOP:'))fail('Shop stock required');shopAccess(req,b.destination);const count=pieces(req.body.quantity);if(count>b.qty)fail('Sale exceeds stock');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),totals=saleTotals(count,req.body.unitPrice,req.body.taxPercent,req.body.discount||0),factory=req.departmentCompany.factories.find(f=>String(f._id)===String(scope.factoryId));
 if(totals.tax&&!factory?.gstin)fail('Supplier GSTIN required for GST invoice');if(!['CASH','BANK'].includes(req.body.paymentMode))fail('Select cash or bank payment');if(totals.tax&&!['CGST_SGST','IGST'].includes(req.body.taxType))fail('GST tax type required');
 const out=await take(scope,session,lot.sku,location(b),count),cost=-out.value;b.qty-=count;await b.save({session});const journals=[{account:req.body.paymentMode,debit:totals.gross,credit:0},{account:'SALES',debit:0,credit:totals.net},{account:'OUTPUT_TAX',debit:0,credit:totals.tax},{account:'COGS',debit:cost,credit:0},{account:'INVENTORY',debit:0,credit:cost}];
 const documentId=await journalMove(scope,session,req,[out],journals,totals,'RETAIL_SALE');const customer={name:clean(req.body.customerName),phone:clean(req.body.customerPhone),email:clean(req.body.customerEmail),gstin:clean(req.body.customerGstin),marketingConsent:req.body.marketingConsent===true};
 const [sale]=await Sale.create([{...scope,key:req.body.key,number:await sequence(scope,session,'POS'),shop:b.destination,sku:lot.sku,quantity:count,totals,taxPercent:Number(req.body.taxPercent||0),taxType:totals.tax?req.body.taxType:'NO_TAX',customer,supplier:{name:req.departmentCompany.companyName,address:factory?.billingAddress||factory?.address,gstin:factory?.gstin},paymentMode:req.body.paymentMode,documentId,createdBy:req.user.userId}],{session});return {bundleId:String(b._id),quantity:count,documentId,details:{sale}};
 }));}));
router.post('/return',asyncHandler(async(req,res)=>{requireAccess(req,'SHOP');res.json(await transaction(req,'RETURN',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.body.saleId))fail('Invalid sale');const sale=await Sale.findOne({...scope,_id:req.body.saleId}).session(session);if(!sale)fail('Sale not found');shopAccess(req,sale.shop);const count=pieces(req.body.quantity);if(count>sale.quantity-sale.returned)fail('Return exceeds unreturned sale');if(!clean(req.body.reason))fail('Return reason required');
 const origin=await Event.findOne({...scope,key:sale.key}).session(session),parent=await Bundle.findOne({...scope,_id:origin.bundleId}).session(session),lot=await Lot.findOne({...scope,_id:parent.lotId}).session(session),child=await newBundle(scope,session,lot,count,'CHECKING',String(parent._id));
 const document=await ErpDocument.findOne({...scope,_id:sale.documentId}).session(session),totalCost=document.journals.find(j=>j.account==='COGS').debit,remaining=count===sale.quantity-sale.returned;
 const prior=await Event.find({...scope,kind:'RETURN','details.saleId':String(sale._id)}).session(session);const used=k=>prior.reduce((n,e)=>n+(e.details.refund?.[k]||0),0);
 const net=remaining?sale.totals.net-used('net'):ratio(sale.totals.net,count,sale.quantity),tax=remaining?sale.totals.tax-used('tax'):ratio(sale.totals.tax,count,sale.quantity),cost=remaining?totalCost-prior.reduce((n,e)=>n+e.details.cost,0):ratio(totalCost,count,sale.quantity),gross=net+tax;
 const journals=[{account:sale.paymentMode,debit:0,credit:gross},{account:'SALES',debit:net,credit:0},{account:'OUTPUT_TAX',debit:tax,credit:0},{account:'COGS',debit:0,credit:cost},{account:'INVENTORY',debit:cost,credit:0}];const documentId=await journalMove(scope,session,req,[{sku:lot.sku,location:location(child),delta:count*1000,value:cost}],journals,{net:-net,tax:-tax,gross:-gross},'RETAIL_RETURN');sale.returned+=count;await sale.save({session});return {quantity:count,documentId,details:{saleId:String(sale._id),refund:{net,tax,gross},cost,bundle:child,reason:clean(req.body.reason)}};
 }));}));
router.get('/marketing/analysis',asyncHandler(async(req,res)=>{
 requireAccess(req,'MARKETING',false);const scope=workspaceFilter(),days=Number(req.query.days||30);if(!Number.isInteger(days)||days<1||days>365)fail('Analysis days 1–365');const rows=await Sale.find({...scope,createdAt:{$gte:new Date(Date.now()-days*86400000)}}).limit(10001).lean();if(rows.length>10000)fail('Use smaller analysis window');const bundles=await Bundle.find({...scope,qty:{$gt:0}}).limit(10001).lean();if(bundles.length>10000)fail('Stock report exceeds limit');const lots=await Lot.find({...scope,_id:{$in:[...new Set(bundles.map(b=>b.lotId))]}}).lean(),skuBy=new Map(lots.map(l=>[String(l._id),l.sku])),group=new Map();
 for(const s of rows){const k=`${s.shop}|${s.sku}`,g=group.get(k)||{shop:s.shop,sku:s.sku,sold:0,returns:0,stock:0,inTransit:0};g.sold+=s.quantity-s.returned;g.returns+=s.returned;group.set(k,g);}
 for(const b of bundles){if(!b.stage.startsWith('SHOP:')&&!b.stage.startsWith('TRANSIT_SHOP:'))continue;const sku=skuBy.get(b.lotId),k=`${b.destination}|${sku}`,g=group.get(k)||{shop:b.destination,sku,sold:0,returns:0,stock:0,inTransit:0};g[b.stage.startsWith('SHOP:')?'stock':'inTransit']+=b.qty;group.set(k,g);}
 res.json({days,note:'Suggestions require human approval; no automatic purchase/production posting. Uses net sales, not stockout-adjusted demand.',rows:[...group.values()].map(g=>({...g,suggested:demandSuggestion(g.sold,days,Number(req.query.leadDays||14),Number(req.query.safety||0),g.stock,g.inTransit)}))});
}));
router.get('/corrections',asyncHandler(async(req,res)=>{if(!['admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');res.json(await Event.find({...workspaceFilter(),kind:{$in:['DELIVERY','ADVANCE','CHECK','PACK','TRANSFER','SPLIT']},reversedBy:{$exists:false}}).sort({_id:-1}).limit(200).lean());}));
router.post('/undo',asyncHandler(async(req,res)=>{
 if(!['admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator required');requireAccess(req,'CHECKING');
 res.json(await transaction(req,'UNDO',async(scope,session)=>{
  if(!mongoose.isValidObjectId(req.body.eventId)||!clean(req.body.reason)||req.body.confirm!=='UNDO MOVEMENT')fail('Select event, reason and type UNDO MOVEMENT');
  const original=await Event.findOne({...scope,_id:req.body.eventId}).session(session);if(!original||original.reversedBy||!['DELIVERY','ADVANCE','CHECK','PACK','TRANSFER','SPLIT'].includes(original.kind))fail('Active reversible movement required');
  const docs=await ErpDocument.find({...scope,'metadata.departmentEventKey':original.key,reversedBy:{$exists:false}}).sort({_id:-1}).session(session);if(!docs.length)fail('No reversible movement documents');
  const sourceRestore=new Map();
  for(const doc of docs){
   for(const m of doc.moves.filter(m=>m.delta>0&&m.location.startsWith('DPT:'))){
    const code=m.location.split(':').at(-1),child=await Bundle.findOne({...scope,code}).session(session),balance=await ErpBalance.findOne({...scope,key:`${m.sku}@${m.location}`}).session(session);
    if(!child||child.qty*1000!==m.delta||!balance||balance.qty!==m.delta||balance.value!==m.value)fail('Child stock has moved; undo downstream movements first');
    child.qty=0;await child.save({session});
   }
   for(const m of doc.moves.filter(m=>m.delta<0&&m.location.startsWith('DPT:'))){const code=m.location.split(':').at(-1);sourceRestore.set(code,(sourceRestore.get(code)||0)-m.delta/1000);}
   const reversal=await journalMove(scope,session,req,doc.moves.slice().reverse().map(m=>({sku:m.sku,location:m.location,delta:-m.delta,value:-m.value})),doc.journals.map(j=>({...j,debit:j.credit,credit:j.debit})),{net:0,tax:0,gross:0},'DEPARTMENT_CORRECTION');doc.reversedBy=reversal;await doc.save({session});
  }
  for(const [code,count] of sourceRestore){const parent=await Bundle.findOne({...scope,code}).session(session);if(!parent)fail('Source bundle unavailable');parent.qty+=count;await parent.save({session});}
  if(original.kind==='DELIVERY'){await Lot.updateOne({...scope,_id:original.lotId},{$set:{status:'CANCELLED'}},{session});}
  if(original.kind==='ADVANCE'&&original.details?.bundle?.stage==='CHECKING'){const parent=await Bundle.findOne({...scope,_id:original.bundleId}).session(session);if(parent?.stage==='STITCHED'){const lot=await Lot.findOne({...scope,_id:parent.lotId}).session(session);if(!lot||lot.received<original.quantity)fail('Inward reconciliation required');lot.received-=original.quantity;await lot.save({session});}}
  original.reversedBy=req.body.key;await original.save({session});return {details:{eventId:String(original._id),reason:clean(req.body.reason)}};
 }));
}));
router.post('/waste-disposal',asyncHandler(async(req,res)=>{requireAccess(req,'CHECKING');if(!['admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Administrator approval required for disposal');res.json(await transaction(req,'WASTE_DISPOSAL',async(scope,session)=>{
 const b=await getBundle(req.body.bundleId,scope,session);if(b.stage!=='WASTE')fail('Waste bundle required');const count=pieces(req.body.quantity);if(count>b.qty||!clean(req.body.reason))fail('Valid quantity and disposal reason required');const lot=await Lot.findOne({...scope,_id:b.lotId}).session(session),out=await take(scope,session,lot.sku,location(b),count),cost=-out.value;b.qty-=count;await b.save({session});const documentId=await journalMove(scope,session,req,[out],[{account:'WASTE_EXPENSE',debit:cost,credit:0},{account:'INVENTORY',debit:0,credit:cost}]);return {bundleId:String(b._id),quantity:count,documentId,details:{reason:clean(req.body.reason)}};
 }));}));
router.get('/demands',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING',false);res.json(await Demand.find(workspaceFilter()).sort({_id:-1}).limit(2000).lean());}));
router.post('/demands',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING');res.json(await transaction(req,'DEMAND',async(scope,session)=>{
 const sku=clean(req.body.sku).toUpperCase(),shop=clean(req.body.shop);if(!await ErpSku.exists({...scope,code:sku,kind:'FINISHED'}).session(session)||!await Master.exists({...scope,key:shop,kind:'SHOP'}).session(session))fail('Finished SKU and shop required');const [d]=await Demand.create([{...scope,number:await sequence(scope,session,'DEM'),sku,shop,quantity:pieces(req.body.quantity),reason:clean(req.body.reason),requestedBy:req.user.userId}],{session});return {details:{demand:d}};
 }));}));
router.post('/demands/:id/decision',asyncHandler(async(req,res)=>{requireAccess(req,'MARKETING');if(!['admin','company_admin'].includes(req.user.role))throw new ApiError(403,'Company administrator decision required');res.json(await transaction(req,'DEMAND_DECISION',async(scope,session)=>{
 if(!mongoose.isValidObjectId(req.params.id))fail('Invalid demand ID');const d=await Demand.findOne({...scope,_id:req.params.id}).session(session);if(!d||d.status!=='PENDING')fail('Pending demand required');if(!['APPROVED','REJECTED'].includes(req.body.status)||!clean(req.body.notes))fail('Decision and notes required');if(d.requestedBy===req.user.userId)fail('Independent decision required');d.status=req.body.status;d.decidedBy=req.user.userId;d.decisionNotes=clean(req.body.notes);await d.save({session});return {details:{demand:d}};
 }));}));
export default router;
