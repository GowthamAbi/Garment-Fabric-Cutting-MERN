import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {warehouseExportRecords} from "../src/config/warehouseExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Warehouse");
const base={department:"WAREHOUSE",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.warehouse.read","approval.head.warehouse"]};
const staff={...base,role:"department_entry",permissions:["department.warehouse.read","department.warehouse.write"]};
test("Warehouse workbook 22 options: 10 Head, 12 Staff",()=>{
 assert.equal(rows.length,22);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",12]]){
  const found=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["WAREHOUSE"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(found.length,count);
  assert.deepEqual(found,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All Warehouse workbook options map to actual existing AppRoutes",()=>{
 for(const row of rows){
  const target=excelOptionTarget({...row,departmentCode:"WAREHOUSE"});
  assert.ok(target,`${row.id}: no mapped screen`);
  assert.ok(cases.has(target),`${row.id}: missing case ${target}`);
 }
});
test("Warehouse Staff uses existing transactional ERP transfers, relocations and reviewed count",()=>{
 const page=get("../src/pages/erp/WarehouseDepartmentPage.jsx");
 const api=get("../src/api/warehouseDepartmentApi.js");
 const routes=get("../../server/src/erp/departmentRoutes.js");
 assert.match(page,/receiveWarehouseBundle/);
 assert.match(page,/relocateWarehouseStock/);
 assert.match(page,/BundleTrace/);
 assert.match(page,/independent Administrator approval|different authorized company administrator/i);
 assert.match(api,/erp\/departments/);
 assert.match(api,/\/stock-exceptions/);
 assert.match(api,/\/warehouse-bins/);
 assert.match(routes,/crossHandoff/);
 assert.match(routes,/sourceWarehouse=new Map/);
});
test("Warehouse Excel exports preserve warehouse, transit, bin and stock count quantities",()=>{
 const data={
  locations:[{key:"WH1",name:"Warehouse One"}],
  bins:[{warehouse:"WH1",key:"BIN1",rack:"R1",bin:"B1"}],
  stocks:[{warehouse:"WH1",sku:"TEE-M",quantity:30,bundleCount:2}],
  bundles:[{code:"C1",quantity:30,stage:"WAREHOUSE:WH1",warehouse:"WH1"}],
  inbound:[{origin:"DISPATCH",warehouse:"WH1",shippedPcs:15,receivedPcs:10,pendingPcs:5}],
  history:[{kind:"TRANSFER",warehouse:"WH1",quantity:10}],
  requests:[{warehouse:"WH1",expectedPcs:30,countedPcs:27,differencePcs:3,status:"PENDING"}]
 };
 assert.equal(warehouseExportRecords("stock",data)[0]["Stock PCS"],30);
 assert.equal(warehouseExportRecords("receipts",data)[0]["Receipt Pending"],5);
 assert.equal(warehouseExportRecords("putaway",data)[0].Rack,"R1");
 assert.equal(warehouseExportRecords("adjustment",data)[0]["Variance PCS"],3);
 assert.equal(warehouseExportRecords("history",data)[0].PCS,10);
 assert.equal(warehouseExportRecords("ledger",data)[0].Bundle,"C1");
});
test("Wrong subscription makes Warehouse unavailable to Warehouse staff",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["SHOP"]}),[]);
});
