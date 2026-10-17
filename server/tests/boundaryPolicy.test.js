import test from 'node:test';
import assert from 'node:assert/strict';
import {DEPARTMENTS} from '../../shared/departmentCatalogue.js';
import {boundaryOptions,assertBoundary,assertOutwardBoundary,inwardStage,outwardAllowed} from '../src/erp/boundaryPolicy.js';
const company=departments=>({departmentCatalogueVersion:1,enabledDepartments:departments,entitlements:{maxDepartments:departments.length,modules:departments}});
test('every single-department package has independent external input without adjacent licence',()=>{
 for(const d of DEPARTMENTS.filter(d=>d!=='HR')){const c=company([d]),b=boundaryOptions(c,d);assert.equal(b.externalInward,true,d);assert.doesNotThrow(()=>assertBoundary(c,d,'IN'));if(!['SHOP','MARKETING'].includes(d))assert.equal(b.externalOutward,true,d);}
 assert.throws(()=>boundaryOptions(company(['SHOP']),'PACKING'));
 assert.equal(boundaryOptions(company(['HR']),'HR').externalInward,false);
 assert.equal(boundaryOptions(company(['HR']),'HR').externalOutward,false);
 assert.throws(()=>assertBoundary(company(['HR']),'HR','IN'));
 assert.throws(()=>assertBoundary(company(['HR']),'HR','OUT'));
});
test('integrated neighbours cannot be bypassed by external receipt or outward',()=>{
 const c=company(DEPARTMENTS);for(const d of ['CUTTING','DELIVERY','STITCHING','INWARD','CHECKING','IRONING','PACKING','DISPATCH','WAREHOUSE','SHOP','MARKETING'])assert.throws(()=>assertBoundary(c,d,'IN'),d);
 for(const d of ['FABRIC','CUTTING','DELIVERY','STITCHING','INWARD','CHECKING','IRONING','PACKING','DISPATCH','WAREHOUSE'])assert.throws(()=>assertBoundary(c,d,'OUT'),d);
});
test('external rework follows Stitching licence while good goods follow Ironing licence',()=>{
 const c=company(['CHECKING','IRONING']);assert.equal(boundaryOptions(c,'CHECKING').externalRework,true);assert.doesNotThrow(()=>assertOutwardBoundary(c,'CHECKING','REWORK'));assert.throws(()=>assertOutwardBoundary(c,'CHECKING','GOOD'));assert.throws(()=>assertOutwardBoundary(company(['CHECKING','STITCHING']),'CHECKING','REWORK'));
 assert.equal(outwardAllowed('CHECKING','WASTE'),false);assert.equal(outwardAllowed('STITCHING','OP:0'),false);assert.equal(outwardAllowed('STITCHING','STITCHED'),true);
});
test('receipts start at receiving department; location and completion guards apply',()=>{
 assert.equal(inwardStage('PACKING'),'IRONED');assert.equal(inwardStage('IRONING'),'GOOD');assert.equal(inwardStage('SHOP','S1'),'SHOP:S1');assert.throws(()=>inwardStage('WAREHOUSE'));assert.equal(outwardAllowed('INWARD','INWARD_READY'),true);assert.equal(outwardAllowed('INWARD','STITCHED'),false);assert.equal(outwardAllowed('WAREHOUSE','WAREHOUSE:W1'),true);
});
