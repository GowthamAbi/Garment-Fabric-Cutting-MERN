import test from 'node:test';
import assert from 'node:assert/strict';
import {DEPARTMENTS,WORKFLOW_DEPARTMENTS,departmentSelection,planModules,licensedDepartments} from '../../shared/departmentCatalogue.js';
import {enabledDepartment} from '../src/erp/departmentPolicy.js';
import {checkUserQuota} from '../src/utils/entitlementPolicy.js';
test('shared catalogue covers HR as a separately licensed non-stock department',()=>{
 assert.equal(DEPARTMENTS.length,16);assert.equal(new Set(DEPARTMENTS).size,16);assert.equal(DEPARTMENTS.at(-2),'HR');assert.equal(DEPARTMENTS.at(-1),'ACCOUNTS');assert.equal(WORKFLOW_DEPARTMENTS.length,9);
 assert.deepEqual(departmentSelection(['Fabric','despatch','shope']),['FABRIC','DISPATCH','SHOP']);
 assert.throws(()=>departmentSelection(['SHOP','Shope']));assert.throws(()=>departmentSelection(['unknown']));assert.throws(()=>departmentSelection([]));
 assert.deepEqual(planModules(['Fabric','ERP_FINANCE']),['FABRIC','ERP_FINANCE']);assert.throws(()=>planModules(['ERP_CORE']));
 assert.deepEqual(licensedDepartments(['Fabric','ERP_CORE','shope']),['FABRIC','SHOP']);
});
test('canonical company denies unselected or unlicensed departments',()=>{
 const company={departmentCatalogueVersion:1,enabledDepartments:['STITCHING'],entitlements:{maxDepartments:1,modules:['STITCHING']}};
 assert.equal(enabledDepartment(company,'STITCHING'),true);assert.equal(enabledDepartment(company,'FABRIC'),false);assert.equal(enabledDepartment(company,'PACKING'),false);
 assert.equal(enabledDepartment({...company,entitlements:{maxDepartments:1,modules:[]}},'STITCHING'),false);
 assert.equal(enabledDepartment({...company,enabledDepartments:[]},'STITCHING'),false);
});
test('legacy contracts retain the previous nine-stage behavior until reviewed',()=>{
 const company={enabledDepartments:['STITCHING','PACKING'],entitlements:{maxDepartments:2,modules:['Fabric','Cutting']}};
 assert.equal(enabledDepartment(company,'STITCHING'),true);assert.equal(enabledDepartment({...company,departmentCatalogueVersion:0},'PACKING'),true);
 assert.equal(enabledDepartment(company,'SHOP'),false);assert.equal(enabledDepartment(company,'FABRIC'),true);
 assert.equal(enabledDepartment({...company,departmentCatalogueVersion:1},'STITCHING'),false);
});
test('new company user assignment respects selected department and user quota',()=>{
 const plan={maxUsers:3,maxDepartments:1},company={departmentCatalogueVersion:1,enabledDepartments:['STITCHING']};
 assert.doesNotThrow(()=>checkUserQuota(plan,[],'STITCHING',company));
 assert.throws(()=>checkUserQuota(plan,[],'WAREHOUSE',company));assert.throws(()=>checkUserQuota(plan,[{},{},{}],'STITCHING',company));
});
