import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRouting,routedNext,routeAdvance,routeActor,bomUsable} from '../src/erp/routingPolicy.js';
const stages=['STITCHING','INWARD','CHECKING','IRONING','PACKING','DISPATCH'];
const company={departmentCatalogueVersion:1,enabledDepartments:stages,entitlements:{maxDepartments:6,modules:stages}};
test('approved routing supports direct packing, direct dispatch and omitted QC in production order',()=>{
 for(const route of [['STITCHING','PACKING','DISPATCH'],['STITCHING','DISPATCH'],['CHECKING','DISPATCH'],stages])assert.deepEqual(validateRouting(route,company),route);
 assert.equal(routedNext(['STITCHING','PACKING','DISPATCH'],'STITCHING'),'IRONED');assert.equal(routedNext(['STITCHING','DISPATCH'],'STITCHING'),'PACKED');assert.equal(routedNext(['CHECKING','PACKING','DISPATCH'],'CHECKING'),'IRONED');
});
test('invalid, repeated, reversed and unsubscribed route stages are rejected',()=>{
 for(const r of [['STITCHING'],['DISPATCH','STITCHING'],['STITCHING','STITCHING','DISPATCH'],['UNKNOWN','DISPATCH'],['PACKING','IRONING','DISPATCH']])assert.throws(()=>validateRouting(r,company));
 assert.throws(()=>validateRouting(['STITCHING','DISPATCH'],{...company,enabledDepartments:['STITCHING']}));
});
test('lot snapshot controls transition and actor without changing legacy routing',()=>{
 const lot={routeSnapshot:{stages:['STITCHING','DISPATCH']}};assert.equal(routeActor(lot,'STITCHED','INWARD'),'STITCHING');assert.equal(routeAdvance(lot,'STITCHED','CHECKING'),'PACKED');assert.equal(routeAdvance({},'STITCHED','CHECKING'),'CHECKING');assert.equal(routeActor({},'STITCHED','INWARD'),'INWARD');
 assert.equal(routeAdvance({routeSnapshot:{stages:['IRONING','DISPATCH']}},'IRONING','IRONED'),'PACKED');
});
test('new draft BOMs cannot be consumed, while existing contracts retain compatibility',()=>{
 assert.equal(bomUsable({approvalVersion:1,approvalStatus:'DRAFT'}),false);assert.equal(bomUsable({approvalVersion:1,approvalStatus:'APPROVED'}),true);assert.equal(bomUsable({code:'OLD'}),true);
});
