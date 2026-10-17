import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {shopExportRecords} from "../src/config/shopExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Shop");
const base={department:"SHOP",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.shop.read","approval.head.shop"]};
const staff={...base,role:"department_entry",permissions:["department.shop.read","department.shop.write"]};
test("Shop has 21 Excel options: 10 Head and 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const ids=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["SHOP"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(ids.length,count);
  assert.deepEqual(ids,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All Shop workbook rows resolve a real app route",()=>{
 for(const item of rows){
  const page=excelOptionTarget({...item,departmentCode:"SHOP"});
  assert.ok(page,`${item.id}: no mapped screen`);
  assert.ok(cases.has(page),`${item.id}: missing AppRoutes case ${page}`);
 }
});
test("Online POS uses transactional ERP sale and refund requests are non-posting",()=>{
 const page=get("../src/pages/erp/ShopDepartmentPage.jsx");
 const api=get("../src/api/shopDepartmentApi.js");
 const server=get("../../server/src/erp/departmentRoutes.js");
 assert.match(page,/createShopSale/);
 assert.match(page,/OfflinePos/);
 assert.match(page,/requestCustomerReturn/);
 assert.match(page,/does NOT refund payment or alter stock/);
 assert.match(api,/erp\/departments/);
 assert.match(api,/\/sale/);
 assert.match(api,/\/shop-return-requests/);
 assert.match(server,/router.post\('\/return'/);
 assert.match(server,/saleTotals\(count,req.body.unitPrice/);
});
test("Shop export: sales INR, stock quantities, posted invoice, transit, return review",()=>{
 const data={
  shopSales:[{shop:"A",invoices:1,soldNetPcs:8,netSalesPaise:80000,
   grossSalesPaise:84000,cogsComplete:true,cogsPaise:52000,marginPaise:28000}],
  invoices:[{number:"POS1",shop:"A",sku:"TEE-M",quantity:10,returnedPcs:2,
   soldNetPcs:8,invoiceGrossPaise:105000,refundPaise:21000,grossPaise:84000,
   paymentMode:"CASH",marginPaise:28000}],
  stockBySku:[{shop:"A",sku:"TEE-M",size:"M",quantity:15,bundles:2}],
  stock:[{shop:"A",bundleNo:"B1",sku:"TEE-M",quantity:15}],
  receipts:[{shop:"A",bundleNo:"T1",sentPcs:8,receivedPcs:3,pendingPcs:5}],
  incoming:[{shop:"A",bundleNo:"T1",quantity:5}],
  requests:[{shop:"A",invoice:"POS1",quantity:2,status:"PENDING"}]
 };
 assert.equal(shopExportRecords("sales",data)[0]["Net Sales INR"],800);
 assert.equal(shopExportRecords("margin",data)[0]["Margin INR"],280);
 assert.equal(shopExportRecords("invoice",data)[0]["Net Collected INR"],840);
 assert.equal(shopExportRecords("stock",data)[0]["Available PCS"],15);
 assert.equal(shopExportRecords("pos",data)[0].PCS,15);
 assert.equal(shopExportRecords("receipt",data)[0]["Pending PCS"],5);
 assert.equal(shopExportRecords("return",data)[0].Status,"PENDING");
});
test("Unsubscribed SHOP is hidden from single department staff",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["WAREHOUSE"]}),[]);
});
