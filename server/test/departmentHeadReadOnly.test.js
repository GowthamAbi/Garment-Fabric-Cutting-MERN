import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedDepartment} from '../src/erp/departmentPolicy.js';
import {enforceAccessBoundary} from '../src/middleware/accessMiddleware.js';
const head={role:'department_incharge',accessPolicyVersion:1,accessScope:'DEPARTMENT',department:'FABRIC',permissions:['department.fabric.read','department.fabric.write']};
const staff={...head,role:'department_entry'};
const factory={...head,accessScope:'LOCATION'};
test('assigned department head may view but must not create operational movements',()=>{
 assert.equal(allowedDepartment(head,'FABRIC',false),true);
 assert.equal(allowedDepartment(head,'FABRIC',true),false);
 assert.equal(allowedDepartment(head,'CUTTING',false),false);
});
test('assigned staff can write only own authorized department',()=>{
 assert.equal(allowedDepartment(staff,'FABRIC',true),true);
 assert.equal(allowedDepartment(staff,'CUTTING',true),false);
});
test('location-scoped factory head retains expressly granted operations',()=>{
 assert.equal(allowedDepartment(factory,'FABRIC',true),true);
});
test('legacy operational write routes deny single-department head even with accidental write grant',()=>{
 assert.throws(()=>enforceAccessBoundary({user:head,originalUrl:'/api/fabric-cutting/inwards',method:'POST'}),e=>e.statusCode===403);
 assert.doesNotThrow(()=>enforceAccessBoundary({user:head,originalUrl:'/api/fabric-cutting/inwards',method:'GET'}));
 assert.doesNotThrow(()=>enforceAccessBoundary({user:staff,originalUrl:'/api/fabric-cutting/inwards',method:'POST'}));
});
