import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentSummary } from '../src/erp/departmentReports.js';
import { forecastDemand, dailyNetSales } from '../src/erp/forecastPolicy.js';
import { payrollRule, calculateRulePay, payrollAccrual } from '../src/erp/payrollPolicy.js';
import { posScope, saleDraft } from '../../client/src/utils/offlinePos.js';

test('department reconciliation detects ledger drift and preserves partial DC pending',()=>{
  const lots=[{_id:'L',sku:'TEE-M',section:'VENDOR',sent:10,received:6,operations:['Join','Hem']}];
  const bundles=[{code:'B1',lotId:'L',stage:'OP:1',qty:4},{code:'B2',lotId:'L',stage:'CHECKING',qty:6}];
  const balances=bundles.map(b=>({sku:'TEE-M',location:`DPT:${b.stage}:${b.code}`,qty:b.qty*1000,value:b.qty*100}));
  const report=departmentSummary(lots,bundles,balances);
  assert.equal(report.reconciliation.balanced,true);assert.equal(report.sections[0].pending,4);
  assert.equal(report.stages[0].operation,'Hem');
  assert.equal(departmentSummary(lots,bundles,[{...balances[0],qty:3000},balances[1]]).reconciliation.balanced,false);
  assert.equal(departmentSummary(lots,bundles,[...balances,{sku:'TEE-M',location:'DPT:PACKED:ORPHAN',qty:1000,value:100}]).reconciliation.issues[0].reason,'Unlinked department stock');
  assert.throws(()=>departmentSummary([{...lots[0],received:11}],bundles,balances));
});
test('forecast buffers variability, subtracts stock/transit and flags sparse history',()=>{
  const stable=forecastDemand(Array(30).fill(10),{leadDays:14,stock:50,inTransit:20});
  assert.equal(stable.expected,140);assert.equal(stable.suggested,70);assert.equal(stable.statisticalSafety,0);
  const volatile=forecastDemand(Array.from({length:30},(_,i)=>i%2?20:0),{leadDays:14});assert.ok(volatile.statisticalSafety>0);
  assert.equal(forecastDemand(Array(7).fill(0)).reliability,'SHORT_HISTORY');
  assert.equal(forecastDemand(Array(30).fill(0)).suggested,0);
  assert.equal(forecastDemand(Array(30).fill(10),{stock:10000}).suggested,0);
  assert.throws(()=>forecastDemand([1,2,3]));assert.throws(()=>forecastDemand(Array(30).fill(1),{leadDays:-1}));
  assert.throws(()=>forecastDemand(Array(30).fill(1),{serviceLevel:50}));
});
test('forecast daily buckets exclude outside dates and net returns without artificial negative demand',()=>{
  const daily=dailyNetSales([{createdAt:'2026-10-11T02:00:00Z',quantity:10,returned:2},{createdAt:'2026-10-10T22:00:00Z',quantity:4,returned:0},{createdAt:'2026-10-01',quantity:100}],7,new Date('2026-10-11T12:00:00Z'));
  assert.deepEqual(daily,[0,0,0,0,0,4,8]);
  assert.throws(()=>dailyNetSales([{createdAt:'2026-10-11',quantity:2,returned:3}],7,new Date('2026-10-11')));
});
const ruleInput={key:'POLICY-1',reviewReference:'Accounts approval',effectiveFrom:'2026-01',effectiveTo:'2026-12',pfBasis:'BASIC',pfCap:15000,esiEligibilityCeiling:21000,employeePfBps:1200,employerPfBps:1200,employeeEsiBps:75,employerEsiBps:325};
test('reviewed payroll rule freezes rates and calculates contribution caps and calendar proration',()=>{
  const rule=payrollRule(ruleInput),pay=calculateRulePay({monthlyBasic:30000,monthlyAllowance:1000,paidDays:15,overtime:100},rule,'2026-04');
  assert.equal(pay.amounts.basic,1500000);assert.equal(pay.amounts.allowance,50000);assert.equal(pay.amounts.pf,180000);assert.equal(pay.amounts.esi,0);
  assert.equal(pay.calculation.esiEligible,false);assert.equal(pay.net,pay.gross-pay.deductions);
  assert.equal(pay.calculation.employerPf,180000);assert.equal(pay.calculation.ruleSnapshot.reviewReference,'Accounts approval');
  assert.throws(()=>calculateRulePay({monthlyBasic:10000,paidDays:31},rule,'2026-04'));
  assert.throws(()=>calculateRulePay({monthlyBasic:10000,paidDays:30},rule,'2027-01'));
  assert.throws(()=>calculateRulePay({monthlyBasic:10000,paidDays:1,tax:1000},rule,'2026-04'));
});
test('payroll supports half days, leap-year months and explicitly reviewed zero-rate rules',()=>{
  const rule=payrollRule({...ruleInput,effectiveFrom:'2024-01',effectiveTo:'2024-12',employeePfBps:0,employerPfBps:0,employeeEsiBps:0,employerEsiBps:0,pfCap:null,esiEligibilityCeiling:null});
  const pay=calculateRulePay({monthlyBasic:29000,paidDays:14.5},rule,'2024-02');assert.equal(pay.net,1450000);assert.equal(pay.calculation.calendarDays,29);
  assert.throws(()=>payrollRule({...ruleInput,employeePfBps:undefined}));assert.throws(()=>payrollRule({...ruleInput,reviewReference:''}));
});
test('offline drafts are company/factory/user scoped, immutable retry keys and contain no customer contacts',()=>{
  const user={userId:'U1',companyId:'C1',factoryId:'F1'},scope=posScope(user,'company-one');
  assert.notEqual(scope,posScope({...user,factoryId:'F2'},'company-one'));assert.notEqual(scope,posScope({...user,userId:'U2'},'company-one'));
  const input={bundleId:'a'.repeat(24),quantity:2,unitPrice:100,discount:0,paymentMode:'CASH',taxPercent:0,customerEmail:'private@example.com',password:'secret',key:'1234567890abcdef'};
  const draft=saleDraft(scope,input,new Date('2026-10-11'));
  assert.equal(draft.payload.key,input.key);assert.equal(draft.state,'PENDING');assert.equal(draft.payload.customerEmail,undefined);assert.equal(draft.payload.password,undefined);
  assert.throws(()=>saleDraft(scope,{...input,paymentMode:'BANK'}));assert.throws(()=>saleDraft(scope,{...input,quantity:0.5}));assert.throws(()=>saleDraft(scope,{...input,unitPrice:0.001}));
  assert.throws(()=>posScope(user,'platform'));
});

test('payroll accrual balances gross and employer costs against net pay and contribution liabilities',()=>{
 const pay=calculateRulePay({monthlyBasic:15000,paidDays:30},payrollRule(ruleInput),'2026-04');
 const journals=payrollAccrual(pay);assert.equal(journals.reduce((n,j)=>n+j.debit-j.credit,0),0);
 assert.equal(journals[1].credit,pay.net);assert.equal(journals[0].debit,pay.gross+pay.calculation.employerPf+pay.calculation.employerEsi);
 assert.throws(()=>payrollAccrual({...pay,net:pay.net+1}));
});
