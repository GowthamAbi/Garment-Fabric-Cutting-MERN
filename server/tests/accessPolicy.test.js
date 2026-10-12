import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAccessAssignment,locationAllowed,hasPermission} from '../src/utils/accessPolicy.js';
import {enforceAccessBoundary,legacyDepartment} from '../src/middleware/accessMiddleware.js';
import {authorizeErp} from '../src/erp/policy.js';
import {allowedDepartment} from '../src/erp/departmentPolicy.js';
const f='a'.repeat(24),other='b'.repeat(24),company={ownerUserId:'OWNER',factories:[{_id:f},{_id:other}],enabledDepartments:['STITCHING','SHOP']};
const owner={id:'OWNER',role:'company_owner',accessPolicyVersion:1,accessScope:'COMPANY',factoryId:f};
const target={_id:'USER',role:'store',factoryId:f,department:'STITCHING'};
const assignment={permissions:['department.stitching.write'],accessScope:'DEPARTMENT',department:'STITCHING',assignedFactoryIds:[f]};
test('owner can delegate explicit valid scope but cannot alter ownership/self through assignment',()=>{
 assert.equal(validateAccessAssignment(owner,target,assignment,company).accessPolicyVersion,1);
 assert.throws(()=>validateAccessAssignment(owner,{...target,_id:'OWNER',role:'company_owner'},assignment,company));
 assert.throws(()=>validateAccessAssignment({...owner,id:'USER'},target,assignment,company));
 assert.throws(()=>validateAccessAssignment(owner,target,{...assignment,assignedFactoryIds:['c'.repeat(24)]},company));
});
test('admin cannot delegate financial permission, extra factory or broader scope',()=>{
 const admin={id:'ADMIN',role:'company_admin',accessPolicyVersion:1,accessScope:'DEPARTMENT',department:'STITCHING',factoryId:f,assignedFactoryIds:[f],permissions:['users.roles.assign','department.stitching.write']};
 assert.doesNotThrow(()=>validateAccessAssignment(admin,target,assignment,company));
 assert.throws(()=>validateAccessAssignment(admin,target,{...assignment,permissions:['erp.accounts']},company));
 assert.throws(()=>validateAccessAssignment(admin,target,{...assignment,assignedFactoryIds:[other]},company));
 assert.throws(()=>validateAccessAssignment(admin,target,{...assignment,accessScope:'COMPANY'},company));
 assert.throws(()=>validateAccessAssignment(admin,{...target,factoryId:other},assignment,company));
});
test('company admin name does not grant finance, department, shop or warehouse automatically under strict policy',()=>{
 const admin={role:'company_admin',accessPolicyVersion:1,accessScope:'LOCATION',factoryId:f,permissions:['erp.read','department.shop.read'],assignedShopKeys:[`${f}:SHOP1`],assignedWarehouseKeys:[]};
 assert.equal(authorizeErp(admin,'finance'),false);assert.equal(authorizeErp(admin,'post','PAYMENT'),false);
 assert.equal(allowedDepartment(admin,'STITCHING'),false);assert.equal(locationAllowed(admin,'SHOP','SHOP1'),true);assert.equal(locationAllowed(admin,'SHOP','SHOP2'),false);assert.equal(locationAllowed(admin,'SHOP','SHOP1',other),false);assert.equal(locationAllowed(admin,'WAREHOUSE','WH1'),false);
 assert.equal(authorizeErp({role:'company_admin'},'finance'),true);assert.equal(hasPermission({role:'saas_super_admin'},'erp.read'),false);
});
test('strict self and department scopes deny broad endpoints and unassigned legacy reads',()=>{
 const user={role:'department_entry',accessPolicyVersion:1,accessScope:'DEPARTMENT',department:'STITCHING',permissions:['department.stitching.write'],factoryId:f};
 assert.doesNotThrow(()=>enforceAccessBoundary({user,method:'GET',originalUrl:'/api/erp/departments/catalog'}));
 assert.throws(()=>enforceAccessBoundary({user,method:'GET',originalUrl:'/api/erp/financials'}));
 assert.throws(()=>enforceAccessBoundary({user,method:'GET',originalUrl:'/api/fabric-cutting/stock'}));
 assert.throws(()=>enforceAccessBoundary({user:{...user,accessScope:'SELF'},method:'GET',originalUrl:'/api/erp/departments/catalog'}));
 assert.doesNotThrow(()=>enforceAccessBoundary({user:{...user,accessScope:'SELF'},method:'GET',originalUrl:'/api/auth/profile'}));
 assert.equal(legacyDepartment('/fabric-cutting/plans/X/folding'),'FABRIC');assert.equal(legacyDepartment('/fabric-cutting/stock'),'FABRIC');assert.equal(legacyDepartment('/fabric-cutting/plans'),'CUTTING');
});
test('department scope rejects inactive departments and self profile scope rejects operational grants',()=>{
 assert.throws(()=>validateAccessAssignment(owner,target,{...assignment,department:'WAREHOUSE'},company));
 assert.throws(()=>validateAccessAssignment(owner,target,{...assignment,accessScope:'SELF'},company));
 assert.doesNotThrow(()=>validateAccessAssignment(owner,target,{...assignment,accessScope:'SELF',permissions:[]},company));
});
