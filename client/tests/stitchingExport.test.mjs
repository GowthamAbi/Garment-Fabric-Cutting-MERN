import test from "node:test";
import assert from "node:assert/strict";
import {stitchingExportRecords} from "../src/config/stitchingExport.mjs";
const data={
 operations:[{sku:"SHIRT",masterKey:"OP-V1",sequence:1,operation:"SEAM",completedEventPcs:18}],
 targets:[{date:"2026-10-17",sku:"SHIRT",operation:"SEAM",operator:"A",shift:"DAY",targetPcs:25}],
 defects:[{date:"2026-10-17T09:00:00.000Z",lotId:"L1",kind:"CHECK",department:"STITCHING",quantity:2,reason:"Seam"}]
};
const plans=[{lotNo:"LOT1",orderNo:"O1",dcNo:"DC1",sku:"SHIRT",section:"LINE A",sentPcs:30,
 stitchedPcs:18,handedOverPcs:10,pendingPcs:2,reworkPcs:0,completionPercent:93.3}];
test("Stitching targets view exports the target rows, not lot status",()=>{
 const rows=stitchingExportRecords("targets",data,plans);
 assert.equal(rows.length,1);
 assert.equal(rows[0]["Target PCS"],25);
 assert.equal(rows[0]["Operator"],"A");
 assert.equal(rows[0]["Lot"],undefined);
});
test("Stitching operation and defect views select their own data",()=>{
 assert.equal(stitchingExportRecords("completion",data,plans)[0]["Completed Event PCS"],18);
 assert.equal(stitchingExportRecords("defects",data,plans)[0]["Reason"],"Seam");
 assert.equal(stitchingExportRecords("rework",data,plans)[0]["Quantity PCS"],2);
});
test("Full Stitching report exports uniform named columns across all sections",()=>{
 const rows=stitchingExportRecords("reports",data,plans);
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(x=>x["Report Section"]),[
  "Lot Progress","Operation Completions","Targets","Defects / Rework"]);
 const keys=Object.keys(rows[0]);
 for(const row of rows)assert.deepEqual(Object.keys(row),keys);
 assert.equal(rows[2]["Target PCS"],25);
 assert.equal(rows[3]["Reason"],"Seam");
 assert.equal(rows[0]["Sent PCS"],30);
});
test("Stitching Excel export suppresses empty/unavailable records",()=>{
 assert.deepEqual(stitchingExportRecords("reports",{},[]),[]);
 assert.deepEqual(stitchingExportRecords("targets",{},plans),[]);
});
