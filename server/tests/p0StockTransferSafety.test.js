import test from "node:test";
import assert from "node:assert/strict";
import {crossDepartmentHandoff,warehouseDashboardStageVisible} from "../src/erp/stockTransferSafetyPolicy.js";
test("source may send to a distinct authorized receiving department",()=>{
 for(const [a,b] of [["PACKED","TRANSIT_WAREHOUSE"],
  ["WAREHOUSE:WH1","TRANSIT_SHOP:S2"],["SHOP:S1","TRANSIT_SHOP:S2"],
  ["SHOP:S1","TRANSIT_WAREHOUSE"]])assert.equal(crossDepartmentHandoff(a,b),true);
 for(const [a,b] of [["TRANSIT_WAREHOUSE","WAREHOUSE:WH1"],
  ["TRANSIT_SHOP:S2","SHOP:S2"],["PACKED","SHOP:S1"]])
  assert.equal(crossDepartmentHandoff(a,b),false);
});
test("warehouse generic dashboard hides unverified shop-bound origins",()=>{
 assert.equal(warehouseDashboardStageVisible("TRANSIT_SHOP:S2"),false);
 assert.equal(warehouseDashboardStageVisible("WAREHOUSE:WH1"),true);
 assert.equal(warehouseDashboardStageVisible("TRANSIT_WAREHOUSE"),true);
});
