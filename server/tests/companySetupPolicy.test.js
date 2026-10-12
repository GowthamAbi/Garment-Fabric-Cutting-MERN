import test from 'node:test';
import assert from 'node:assert/strict';
import {factoryInput,poCancellation} from '../src/utils/companySetupPolicy.js';
import {planDocument} from '../src/erp/engine.js';
import {enforceAccessBoundary} from '../src/middleware/accessMiddleware.js';
test('factory metadata normalizes code and rejects invalid identity/billing fields',()=>{
 assert.equal(factoryInput({name:'Second factory',code:' unit-02 '}).code,'UNIT-02');for(const input of [{name:'X',code:'bad/code'},{name:'',code:'A1'},{name:'X',code:'A1',billingEmail:'invalid'},{name:'X',code:'A1',stateCode:'ABC'}])assert.throws(()=>factoryInput(input));
 assert.equal(factoryInput({name:'X',code:'A1',companyId:'OTHER',databaseUri:'secret'}).companyId,undefined);
});
test('partial PO cancellation keeps received quantity and records only cancelled remainder',()=>{
 const po={status:'Part received',orderQty:100,inwardQty:40};const result=poCancellation(po,'Vendor balance cancelled');assert.equal(result.cancelledRemainingQty,60);assert.equal(result.status,'Cancelled');assert.equal(po.inwardQty,40);assert.throws(()=>poCancellation({status:'Completed',orderQty:100,inwardQty:100},'Reason'));assert.throws(()=>poCancellation(po,''));
});
test('ERP receipts cannot reference cancelled/archived POs',()=>{
 for(const flag of ['cancelledAt','archivedAt'])assert.throws(()=>planDocument({type:'GOODS_RECEIPT',sourceId:'PO1',lines:[]},{documents:[{id:'PO1',status:'POSTED',type:'PURCHASE_ORDER',[flag]:new Date()}],skus:[]}),/unavailable/);
});
test('owner does not bypass explicit legacy department licence and self cannot read factory configuration',()=>{
 assert.throws(()=>enforceAccessBoundary({user:{role:'company_owner',accessPolicyVersion:1},originalUrl:'/api/fabric-cutting/stock',accessCompany:{departmentCatalogueVersion:1,enabledDepartments:['SHOP'],entitlements:{maxDepartments:1,modules:['SHOP']}}}),/not subscribed/);
 assert.throws(()=>enforceAccessBoundary({user:{role:'company_admin',accessPolicyVersion:1,accessScope:'SELF',permissions:[]},originalUrl:'/api/auth/factories',method:'GET'}),/profile only/);
});
