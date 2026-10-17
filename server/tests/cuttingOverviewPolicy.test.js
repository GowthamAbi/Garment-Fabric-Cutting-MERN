import test from "node:test";
import assert from "node:assert/strict";
import {cuttingOverviewFilter, cuttingOverviewRows, cuttingOverviewSummary} from "../src/erp/cuttingOverviewPolicy.js";
import {validateCuttingMachine} from "../src/controllers/cuttingDepartmentController.js";
import {legacyDepartment,enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";

test("Cutting target versus actual reports correct pieces/weight, no negative pending",()=>{
  const plans=[{planNo:"C01",dcNo:"D1",totalPlannedPcs:100,totalWantedWeightKg:12,status:"READY"},
    {planNo:"C02",dcNo:"D2",totalPlannedPcs:50,totalWantedWeightKg:5,status:"PLANNED"}];
  const actual=[{planNo:"C01",totalActualPcs:120,totalActualWeightKg:11.225,wasteWeightKg:0.775,status:"COMPLETED"}];
  const entries=[{planNo:"C01",machineType:"SPREADER",status:"PUBLISHED"},{planNo:"C01",machineType:"CUTTER",status:"RUNNING"}];
  const rows=cuttingOverviewRows(plans,actual,entries);
  assert.equal(rows[0].actualPcs,120);assert.equal(rows[0].pendingPcs,0);
  assert.equal(rows[0].completionPercent,100);assert.equal(rows[0].wasteWeightKg,0.775);
  assert.deepEqual(rows[0].cutterStatus,["RUNNING"]);
  assert.equal(rows[1].actualStatus,"NOT_ENTERED");
  assert.deepEqual(cuttingOverviewSummary(rows),{plans:2,targetPcs:150,actualPcs:120,pendingPcs:50,wasteWeightKg:0.775,completedPlans:1});
});

test("Cutting report accepts only safe exact plan filter",()=>{
  assert.deepEqual(cuttingOverviewFilter({planNo:" c/123 "}),{planNo:"C/123"});
  assert.deepEqual(cuttingOverviewFilter({}),{});
  assert.throws(()=>cuttingOverviewFilter({planNo:{$ne:""}}),/Invalid/);
  assert.throws(()=>cuttingOverviewFilter({planNo:"*"}),/Invalid/);
});

test("Cutting machine registration accepts only valid machine & bounded capacity",()=>{
  assert.deepEqual(validateCuttingMachine({machineCode:"spr_01",machineName:"Line 1",machineType:"spreader",capacityPerHour:"500"}),{
    machineCode:"SPR_01",machineName:"Line 1",machineType:"Spreader",capacityPerHour:500,section:"Cutting",active:true
  });
  for (const field of [{machineType:"Elastic"},{machineCode:"*"},{machineName:""},{capacityPerHour:-1},{capacityPerHour:"NaN"}]) {
    assert.throws(()=>validateCuttingMachine({...{machineCode:"SPR_01",machineName:"Line 1",machineType:"spreader",capacityPerHour:500},...field}),/Machine|Invalid|Select/);
  }
});

test("Cutting APIs are department licensed, staff-write and head-read only",()=>{
  const subscription={enabledDepartments:["CUTTING"],entitlements:{modules:["CUTTING"],maxDepartments:1}};
  const staff={role:"department_entry",department:"CUTTING",accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:["department.cutting.read","department.cutting.write"]};
  const head={...staff,role:"department_incharge",permissions:["department.cutting.read"]};
  for (const path of ["/production/cutting-machines","/production/cutting-machine-plans","/production/cutting-machine-status","/production/cutting-overview"]){
    assert.equal(legacyDepartment(path),"CUTTING");
    const get={user:head,method:"GET",originalUrl:"/api"+path,accessCompany:subscription};
    assert.doesNotThrow(()=>enforceAccessBoundary(get),path);
    assert.equal(get.authorizedLegacyDepartment,"CUTTING");
    if(path!=="/production/cutting-machine-status"){
      assert.throws(()=>enforceAccessBoundary({...get,method:"POST"}),/review access/);
    }
    assert.doesNotThrow(()=>enforceAccessBoundary({...get,user:staff,method:"GET"}));
    assert.throws(()=>enforceAccessBoundary({...get,user:{...staff,department:"FABRIC"}}),/outside assigned scope/);
    assert.throws(()=>enforceAccessBoundary({...get,accessCompany:{...subscription,enabledDepartments:["FABRIC"]}}),/not subscribed/);
  }
});

test("Cutting write actions only work for Cutting Staff, never Head or other departments",()=>{
  const scope={enabledDepartments:["CUTTING"],entitlements:{modules:["CUTTING"],maxDepartments:1}};
  const staff={role:"department_entry",department:"CUTTING",accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:["department.cutting.read","department.cutting.write"]};
  const head={...staff,role:"department_incharge"};
  for(const [path,method] of [["/production/cutting-machine-plans","POST"],["/production/cutting-machines","POST"],["/production/cutting-machine-plans/fake/action","PATCH"]]){
    const req={user:staff,accessCompany:scope,method,originalUrl:"/api"+path};
    assert.doesNotThrow(()=>enforceAccessBoundary(req));
    assert.throws(()=>enforceAccessBoundary({...req,user:head}),/review access/);
  }
});
